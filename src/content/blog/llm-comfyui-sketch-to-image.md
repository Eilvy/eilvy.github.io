---
title: 'LLM 接入 ComfyUI 实现「草图主导出图」方案分析'
description: '分析用多模态 LLM 识别用户草图、生成结构化控制参数，再驱动 ComfyUI + ControlNet 出图的完整链路：可行性、Stable Diffusion 模型谱系、8GB 显存选型、ComfyUI 两种使用方式，以及现有开源项目盘点。'
pubDate: 2026-09-18
tags: ['ComfyUI', 'LLM', 'Stable Diffusion', 'AI']
categories: ['AI 绘图', 'AI']
author: 'eilvy'
---

## 一、需求与目标再定义

目标链路是这样的：

```
用户草图(图片)
   └─> LLM 多模态识图 (理解草图构图/主体/风格意图)
          └─> 生成结构化控制参数 (Prompt + ControlNet 参数 + ComfyUI 工作流 JSON)
                 └─> 调用 ComfyUI API 执行
                        └─> 返回最终出图
```

核心诉求可以拆成四条：

- LLM 既是「看图的人」，又是「发指令的人」；
- 图像生成模型以 **ComfyUI 作为客户端承载**；
- 草图作为输入**主导输出**；
- 目标生图模型为 **Stable Diffusion 系列**。

换句话说，这是一个「LLM 当大脑、ComfyUI 当画笔」的组合。

---

## 二、可行性分析

### 2.1 总体结论

**方案可行，属于「工程集成」而非「算法突破」。**

| 维度 | 结论 | 说明 |
|---|---|---|
| 技术通路 | 完全成立 | ComfyUI API + ControlNet 是成熟组合 |
| LLM 识草图 | 可行，有上限 | 顶级多模态模型对简笔/线稿理解够用；极抽象草图仍需用户补文字描述 |
| LLM 出参数 | 成熟 | function call → 参数注入是标准范式 |
| 草图主导输出 | 可达成 | 草图走 ControlNet 约结构，LLM 出 prompt 约风格，叠加实现「主导」 |
| 工程复杂度 | 中 | 主要是中间编排层 + 模板工作流调试，非科研难题 |
| 稳定性/一致性 | 需调参 | ControlNet 强度、denoise、CFG 的平衡决定草图保真度 |

### 2.2 ComfyUI 侧可行性

ComfyUI 原生提供 HTTP API，工作流以 JSON 形式提交 —— 这一点与 LLM function call 生成参数的模式**天然契合**。

关键 API 端点：

| 端点 | 作用 |
|---|---|
| `POST /prompt` | 提交一个完整工作流 JSON（API 格式，带 `prompt`/`client_id`），入队执行 |
| `GET /history/{prompt_id}` | 查询任务结果与产出图片 |
| `GET /view?filename=...` | 下载生成的图片 |
| `POST /upload/image` | 上传草图作为输入 |
| WebSocket `/ws` | 监听执行进度/完成事件 |

**草图 → 出图的技术核心是 ControlNet**：

- **线稿/草图**：`Lineart`、`Scribble`、`Canny`、`HED`（soft edge）等预处理器，可把草图转成结构控制图；
- **直接复用草图**：跳过预处理器，直接把草图喂给 ControlNet（如 `controlnet_scribble` / `controlnet_lineart`）；
- **图生图**：`VAEEncode` 把草图编码进潜空间，叠加 ControlNet 形成双重约束。

分工上是互补而非冲突：**草图主导构图、姿态、结构轮廓；LLM 生成的 prompt 主导风格、质感、主体细节描述。**

LLM 可注入的参数节点：

- `CLIPTextEncode`（正向/负向 prompt）
- `ControlNetApply` 的 `strength`（0–2，控制草图约束强度）
- `KSampler` 的 `seed` / `steps` / `cfg` / `sampler_name`
- 模型路径、分辨率、`denoise`（图生图重绘幅度）
- LoRA 选择与权重

### 2.3 LLM 侧可行性

**识图能力（必需多模态）**

| 方案 | 识别效果 | 接入方式 |
|---|---|---|
| Claude 4.5 / Opus 4 (vision) | 强，对线稿主体/构图描述细致 | API |
| GPT-4o / GPT-5 | 强 | API |
| Qwen2.5-VL / InternVL2 | 中，中文场景可用，细节弱于第一梯队 | 自建 |
| 本地 LLaVA | 较弱，仅适合简单草图 | 自建 |

> 生产环境用 GPT-4o / Claude 级云端多模态；隐私敏感或离线场景用 Qwen2.5-VL（72B 优先）。

**工具调用（function call）Schema 示例：**

```json
{
  "name": "run_comfyui_sketch_render",
  "parameters": {
    "positive_prompt": "string",
    "negative_prompt": "string",
    "controlnet_type": "scribble | lineart | canny",
    "controlnet_strength": "0.0-2.0",
    "denoise": "0.3-1.0",
    "steps": "int",
    "cfg": "float",
    "lora": { "name": "string", "weight": "float" },
    "seed": "int | -1"
  }
}
```

**两种 LLM 接入架构**

**架构 A：LLM 动态拼装工作流 JSON（推荐）**

- 预定义一个**模板工作流**（含 ControlNet + 图生图双控），暴露若干「变量槽位」；
- LLM 通过 function call 输出参数 → 中间层把参数填进模板 → `POST /prompt`。
- 优点：可控、稳定、易测试。缺点：工作流结构固定，扩展新节点需改模板。

**架构 B：LLM 直接生成完整工作流 JSON（激进）**

- 给 LLM ComfyUI 的节点 schema，让它直接生成完整 `prompt` JSON；
- 优点：理论上可自主编排。缺点：**幻觉风险高**，节点名/连线易出错，需要强校验层。
- **生产环境不推荐**，除非用 fine-tune 或强约束提示工程。

> 结论：**用 A 起步，留 B 的口子。**

### 2.4 主要风险与对策

| 风险 | 对策 |
|---|---|
| LLM 对抽象草图理解偏差 | 允许用户附一句话意图，LLM 结合「图 + 文字」生成 prompt |
| 直接生成工作流 JSON 易报错 | MVP 用模板填参，不让 LLM 碰节点连线 |
| 草图保真度不稳 | 给 LLM 暴露 `controlnet_strength`/`denoise`，并设合理默认值 |
| ComfyUI 服务需常驻 | 部署为常驻服务，中间层只做转发 |
| 推理延迟（LLM + 出图串行） | 异步队列化；LLM 与 ComfyUI 之间用任务 id 解耦 |

---

## 三、Stable Diffusion 系列模型谱系

### 3.1 SD 1.x（Stability AI，2022）

| 模型 | 说明 |
|---|---|
| **SD 1.4** | 首个广泛传播的开源文生图模型，512×512，CLIP ViT-L/14 文本编码 |
| **SD 1.5** | 1.4 的微调改进版，**生态最成熟、插件/ControlNet 最全**，至今仍是社区主力之一 |

- 架构：Latent Diffusion + CLIP 文本编码
- 分辨率：512×512（可外推 768）
- 特点：开源免费、可商用许可（CreativeML OpenRAIL-M）、社区微调模型极多
- 草图场景：**配套的 ControlNet 模型最齐全**

### 3.2 SD 2.x（2022 末）

| 模型 | 说明 |
|---|---|
| **SD 2.0** | 改用 OpenCLIP ViT-H 文本编码器，去除训练数据中的 NSFW 与名人内容 |
| **SD 2.1**（512 / 768） | 2.0 的改进版，画质提升，768 版本原生支持高分辨率 |

- 与 1.x **不兼容**：文本编码器、CLIP 维度不同，prompt 写法变化
- 生态分裂：社区资源/微调模型少于 1.5

### 3.3 SDXL（2023）

| 模型 | 说明 |
|---|---|
| **SDXL 1.0**（base + refiner） | 双阶段架构，原生 1024×1024，画质大幅提升 |
| **SDXL 1.0 Base** | 主干生成，文生图主力 |
| **SDXL 1.0 Refiner** | 可选精修模型，对 base 输出做高频细节增强 |
| **SDXL Turbo** | 扩散蒸馏模型，1–4 步出图，实时生成 |
| **SDXL Lightning** | 后续蒸馏加速版，2–8 步出图 |
| **SDXL LCM** | LCM 蒸馏，几步快速出图 |

- 分辨率：原生 1024×1024
- 双层文本编码（OpenCLIP ViT-bigG + CLIP ViT-L），prompt 理解更强
- 草图场景：**目前推荐的主力底模之一**，ControlNet for SDXL 已较成熟

### 3.4 SD3 / SD3.5（2024）

| 模型 | 说明 |
|---|---|
| **SD3 Medium**（2B） | 首个采用 **MMT（Multimodal Transformer）架构**，引入 T5-XXL 文本编码器 |
| **SD3.5 Large**（8B） | 2024 末发布，画质与文字渲染提升 |
| **SD3.5 Large Turbo** | 蒸馏版，4 步出图 |
| **SD3.5 Medium**（2.5B） | 平衡版 |

- 架构变化大：从 U-Net 扩散转向 MMT（类似 DiT 流匹配），文本理解显著增强
- 草图场景：ControlNet 支持仍在追赶，**如要大量用 ControlNet，SD3 目前不是首选**

### 3.5 衍生与生态模型

| 模型 | 说明 |
|---|---|
| **SD 1.5 社区微调**（AnythingV5、DreamShaper、Realistic Vision、ChilloutMix…） | 针对二次元/写实/人像特化 |
| **SDXL 微调**（Juggernaut XL、Pony Diffusion…） | SDXL 上的特化模型 |
| **ControlNet 模型族** | 非生图底模，而是「控制条件」模型，是草图→出图的**核心组件**，需与底模版本匹配 |
| **LoRA / LyCORIS** | 风格/角色微调插件，叠加在底模上 |
| **LCM-LoRA / Turbo-LoRA** | 加速采样，可与任意 SD 底模组合 |

### 3.6 草图场景选型建议

| 优先级 | 底模 | 理由 |
|---|---|---|
| 首选 | **SDXL 1.0 Base** | 画质好、原生 1024、ControlNet 生态已成熟、ComfyUI 原生支持 |
| 次选 | **SD 1.5（或优质微调）** | ControlNet/LoRA 资源最全，调试最省心，适合 MVP 起步 |
| 谨慎 | **SD3 / SD3.5** | 文本理解强，但 ControlNet 生态尚不成熟，草图控制链路弱 |
| 加速选项 | SDXL Lightning / LCM | 叠加在底模上减少采样步数，适合交互速度要求高的场景 |

**关键配套点**：草图流程的成败，很大程度不取决于底模版本，而取决于：

1. **ControlNet 类型与底模版本是否匹配**（SD1.5 的 ControlNet 不能直接用在 SDXL 上）；
2. **预处理器选择**（草图 → lineart / scribble / canny）；
3. 底模 + ControlNet + LoRA 三者的版本对齐。

---

## 四、硬件选型：RTX 4060 Laptop 8GB

### 4.1 显存实况对比

| 模型 | 底模占用(fp16) | +ControlNet 后 | 8GB 能否跑 | 体验 |
|---|---|---|---|---|
| **SD 1.5** | ~3.5–4GB | ~5–6GB(512×512) | 宽裕 | 流畅，30–50 步约 2–4 秒 |
| SD 2.1 (768) | ~4.5GB | ~6–7GB | 可跑但偏紧 | 尚可 |
| **SDXL 1.0** | ~7–8GB | >9GB(1024×1024) | 超显存 | 必须**重度优化**才跑得动 |
| SDXL Turbo/Lightning | ~6–7GB | ~8GB | 勉强 | 步数少但显存仍紧 |
| SD3 Medium | 底模小但 T5-XXL 编码器占大 | >9GB | 不推荐 | 易 OOM |

### 4.2 推荐结论

**主力推荐：SD 1.5（或优质社区微调）**

理由：

1. **显存余量充足**：512×512 下底模 + ControlNet 约占 5–6GB，剩余 2GB+ 给 VAE 解码和系统；
2. **ControlNet 草图生态最全**：lineart / scribble / canny / softedge 的 SD1.5 版都是官方第一方模型；
3. **LoRA 丰富**：可叠加风格/角色 LoRA，配合 LLM 生成的 prompt 切换风格；
4. **推理速度快**：4060 Laptop 上 20–30 步约 2–4 秒；
5. **ComfyUI 原生完美支持**。

具体底模推荐：

- 通用写实：`Realistic Vision V6.0` / `DreamShaper 8`
- 二次元：`AnythingV5` / `Counterfeit V3`
- 通用平衡：`DreamShaper 8`

**进阶备选：SDXL 1.0（需优化手段加持）**

| 优化手段 | 作用 | ComfyUI 中的做法 |
|---|---|---|
| **fp8 底模** | 显存降一半 | 下载 SDXL 的 fp8/safetensors 版本 |
| **`--lowvram` 启动参数** | 动态卸载模型 | ComfyUI 启动加该参数 |
| **xformers / sdpa 注意力** | 降低注意力显存 | ComfyUI 已默认 sdpa |
| **Tiled VAE** | VAE 解码分块，省显存 | 用 `VAEDecodeTiled` 节点 |
| **降低分辨率** | 降占用 | 设分辨率 768 或用 Tile ControlNet |
| **不要同时加载 refiner** | 单底模即可 | 跳过 SDXL refiner |

**不推荐 SD3 / SD3.5** —— ControlNet 生态弱 + 显存吃紧。

### 4.3 启动与节点配置要点

```bash
# 启动参数建议
python main.py --lowvram --preview-method auto --use-pytorch-cross-attention
```

草图工作流关键节点配置（SD 1.5 版）：

- `Load Checkpoint`：选 SD1.5 底模
- `Load ControlNet Model`：选 `control_v11p_sd15_lineart` 或 `control_v11p_sd15_scribble`
- `ControlNetApplyAdvanced`：strength 建议 0.6–0.9
- `KSampler`：steps 20–30，cfg 7，sampler `dpmpp_2m` + `karras`
- 分辨率：512×512 或 512×768
- 可叠 `LoraLoader` 切风格

---

## 五、ComfyUI 使用方式详解

ComfyUI 有**两种使用模式**：手动界面操作和 API 编程调用。两者本质都跑同一套工作流 JSON。

### 5.1 人工使用模式（WebUI 节点界面）

```bash
python main.py                                    # 直接运行
python main.py --lowvram --preview-method auto    # 8GB 显存推荐
run_nvidia_gpu.bat                                # 官方便携包
```

浏览器打开 `http://127.0.0.1:8188` 进入节点编辑界面。

**节点操作基本流程：**

1. **添加节点**：右键画布或双击空白处 → Add Node

   ```
   loaders/        → 加载模型、LoRA、ControlNet
   conditioning/   → CLIP 文本编码（正/负向 prompt）
   sampling/       → KSampler 采样器
   latent/         → 空潜空间、VAE 编解码
   image/          → 图像加载、保存、预览
   controlnet/     → ControlNet 应用
   ```

2. **连线**：拖拽输出端口到输入端口
3. **填参数**：点击节点填写/选择
4. **点顶部 `Queue Prompt` 执行**

**草图 → 出图工作流示例：**

```
[Load Image(草图)] ──IMAGE──> [ControlNet Preprocessor(lineart)]
                                          │IMAGE
                                          ▼
                              [ControlNetApply]
[Load Checkpoint] ──MODEL ──────────────┤
                  ──CLIP──> [CLIPTextEncode(正向)] ──CONDITIONING──┤
                  ──CLIP──> [CLIPTextEncode(负向)] ──CONDITIONING──┤
[Load ControlNet] ──CONTROL_NET───────────────────────────────────┤
                                                                  ▼
[Empty Latent(512×512)] ──────────────────────────────────> [KSampler]
                                                                  │
[Load Checkpoint] ──VAE──────────────────────────────────> [VAEDecode]
                                                                  ▲
[KSampler] ──LATENT─────────────────────────────────────────┘
                                                                  │
                                                          [Preview Image]
```

**常用界面操作：**

| 操作 | 方式 |
|---|---|
| 添加节点 | 右键画布 / 双击空白 |
| 删除节点 | 选中 + Delete |
| 复制节点 | Ctrl+C / Ctrl+V |
| 搜索节点 | 双击空白输入名称 |
| 保存工作流 | 右侧菜单 → Save（存为 `.json`） |
| 加载工作流 | 右侧菜单 → Load / 拖入 `.json` 文件 |
| 暂停/清空队列 | 顶栏 Queue / Cancel |

**模型文件放置位置：**

```
ComfyUI/
├── models/
│   ├── checkpoints/      ← SD 底模 (.safetensors)
│   ├── lora/             ← LoRA 模型
│   ├── controlnet/       ← ControlNet 模型
│   ├── vae/              ← VAE 模型
│   └── embeddings/       ← 嵌入向量
├── custom_nodes/         ← 自定义插件节点
├── output/               ← 生成图片输出目录
└── input/                ← 上传图片目录
```

### 5.2 API 调用模式（编程调用）

**核心概念：API 格式工作流**

ComfyUI 的 API 调用不是调 REST 接口拼参数，而是提交**一整份工作流 JSON**。

从界面导出 API JSON：

1. WebUI 里搭好工作流
2. 点右上角齿轮 → 勾选 **Enable Dev mode Options**
3. 出现 **Save (API Format)** 按钮 → 点击下载 `workflow_api.json`

> 普通 Save 存的是 UI 格式（含位置坐标等），**API 调用必须用 API 格式**。

**API JSON 结构：**

```json
{
  "3": {
    "class_type": "KSampler",
    "inputs": {
      "seed": 156680208700286,
      "steps": 20,
      "cfg": 8,
      "sampler_name": "euler",
      "scheduler": "normal",
      "denoise": 1,
      "model": ["4", 0],
      "positive": ["6", 0],
      "negative": ["7", 0],
      "latent_image": ["5", 0]
    }
  },
  "4": {
    "class_type": "CheckpointLoaderSimple",
    "inputs": { "ckpt_name": "v1-5-pruned-emaonly.safetensors" }
  },
  "5": {
    "class_type": "EmptyLatentImage",
    "inputs": { "width": 512, "height": 512, "batch_size": 1 }
  },
  "6": {
    "class_type": "CLIPTextEncode",
    "inputs": { "text": "a cute cat, masterpiece, best quality", "clip": ["4", 1] }
  },
  "7": {
    "class_type": "CLIPTextEncode",
    "inputs": { "text": "blurry, bad quality", "clip": ["4", 1] }
  },
  "8": {
    "class_type": "VAEDecode",
    "inputs": { "samples": ["3", 0], "vae": ["4", 2] }
  },
  "9": {
    "class_type": "SaveImage",
    "inputs": { "filename_prefix": "ComfyUI", "images": ["8", 0] }
  }
}
```

结构说明：

- 顶层 key 是**节点 ID**（字符串数字，如 `"3"`）
- `class_type`：节点类名
- `inputs`：该节点参数
  - **标量参数**：直接给值（`seed: 123`、`text: "..."`）
  - **连线输入**：`["源节点ID", 输出端口序号]`

**核心 API 端点：**

| 端点 | 方法 | 作用 |
|---|---|---|
| `/prompt` | POST | 提交工作流 JSON，入队执行 |
| `/history/{prompt_id}` | GET | 查询任务执行结果 |
| `/history` | GET | 查询所有历史任务 |
| `/queue` | GET/POST | 查看/取消队列任务 |
| `/view?filename=...` | GET | 下载/查看生成的图片 |
| `/upload/image` | POST | 上传草图/参考图 |
| `/object_info` | GET | 获取所有节点的参数 schema |
| `/system_stats` | GET | 系统状态/GPU 信息 |
| `/ws` | WebSocket | 实时监听执行进度与完成事件 |

**完整调用流程（Python 示例）：**

```python
import requests, json, uuid, random, websocket

COMFY_URL = "http://127.0.0.1:8188"

# 1. 上传草图
def upload_image(image_path):
    with open(image_path, "rb") as f:
        files = {"image": (image_path, f, "image/png")}
        data = {"overwrite": "true", "type": "input"}
        resp = requests.post(f"{COMFY_URL}/upload/image", files=files, data=data)
    return resp.json()   # {"name": "sketch.png", "subfolder": "", "type": "input"}

# 2. 加载模板 + 填参
def build_workflow(sketch_filename, positive_prompt, negative_prompt="blurry, bad quality"):
    with open("workflow_api.json", "r") as f:
        workflow = json.load(f)
    workflow["6"]["inputs"]["text"] = positive_prompt
    workflow["7"]["inputs"]["text"] = negative_prompt
    workflow["3"]["inputs"]["seed"] = random.randint(0, 2**53)
    workflow["10"]["inputs"]["image"] = sketch_filename   # Load Image 节点
    workflow["12"]["inputs"]["strength"] = 0.8            # ControlNet 强度
    workflow["3"]["inputs"]["denoise"] = 0.6              # 图生图 denoise
    return workflow

# 3. 提交任务
def queue_prompt(workflow):
    client_id = str(uuid.uuid4())
    payload = {"prompt": workflow, "client_id": client_id}
    resp = requests.post(f"{COMFY_URL}/prompt", json=payload)
    return resp.json(), client_id   # {"prompt_id": "...", "number": 1, "node_errors": {}}

# 4. 等待结果（WebSocket）
def wait_for_result(prompt_id, client_id):
    ws = websocket.WebSocket()
    ws.connect(f"ws://127.0.0.1:8188/ws?clientId={client_id}")
    while True:
        data = json.loads(ws.recv())
        if data["type"] == "executing":
            if data["data"]["node"] is None and data["data"]["prompt_id"] == prompt_id:
                break
        if data["type"] == "execution_error":
            print(f"执行出错: {data['data']}")
            break
    ws.close()

# 5. 获取结果图片
def get_result_image(prompt_id):
    history = requests.get(f"{COMFY_URL}/history/{prompt_id}").json()
    outputs = history[prompt_id]["outputs"]
    images = []
    for node_id, node_output in outputs.items():
        if "images" in node_output:
            for img in node_output["images"]:
                url = (f"{COMFY_URL}/view?filename={img['filename']}"
                       f"&subfolder={img['subfolder']}&type=output")
                images.append(requests.get(url).content)
    return images

# 完整串联
image_info = upload_image("my_sketch.png")
workflow = build_workflow(image_info["name"], "a beautiful landscape painting, watercolor style")
result, client_id = queue_prompt(workflow)
wait_for_result(result["prompt_id"], client_id)
images = get_result_image(result["prompt_id"])
with open("result.png", "wb") as f:
    f.write(images[0])
```

**`/object_info` —— 动态发现节点参数：**

```python
node_schemas = requests.get(f"{COMFY_URL}/object_info").json()
print(node_schemas["KSampler"])   # 该节点的输入、输出、参数范围、可选值
# 这正是给 LLM function call 写 schema 的依据
```

### 5.3 两种模式对比

| 维度 | 人工 WebUI | API 调用 |
|---|---|---|
| 工作方式 | 拖拽节点、连线 | 提交 JSON |
| 使用者 | 设计师/调试者 | 程序/LLM |
| 参数修改 | 界面上点选填入 | 修改 JSON 中的字段值 |
| 工作流来源 | 手动搭建 | 从模板加载 + 动态填参 |
| 调试 | 直观、所见即所得 | 需打印 JSON、查日志 |
| 自动化 | 不支持 | 适合 LLM 调用 |
| 适合场景 | 调试工作流、找最优参数 | 生产、批量、自动化 |

**关键衔接点：**

```
人工 WebUI 调试 ──导出 workflow_api.json──> API 模板 ──> LLM 填参 ──> POST /prompt
```

### 5.4 对本方案的具体含义

1. **在 ComfyUI WebUI 里手动搭建并调试**好草图 → ControlNet → 出图的工作流；
2. **开启 Dev mode → Save (API Format)** 导出 `workflow_api.json`；
3. 在 JSON 里找到 prompt、seed、strength、denoise 等字段，**记下节点 ID**；
4. 中间编排层加载模板，LLM 的 function call 输出值填入对应字段；
5. POST 给 ComfyUI，等结果回传。

> LLM 完全不需要理解节点连线逻辑，只需输出几个关键参数值 —— 这正是**用「模板填参」架构而非让 LLM 直接生成工作流**的原因。

---

## 六、现有开源项目盘点

### 6.1 直接对标方案的核心项目

**comfyui_LLM_party（最贴合）**

- 链接：https://github.com/heshengtao/comfyui_LLM_party
- **定位**：在 ComfyUI 内部用节点搭建 LLM Agent 框架，融合 LLM 工作流与图像工作流。
- **核心能力**：
  - LLM 多工具调用（multi-tool call）、角色设定
  - **多模态识图**节点（LLM 看图 → 输出文字/prompt → 喂给图像流程）
  - RAG / GraphRAG 知识库、单 Agent 到多 Agent 环形/辐射交互
  - 可接入本地模型、社交平台等
- **关系**：几乎是想法的「现成 ComfyUI 节点化实现」，**最值得优先精读**。

**comfyui-mcp（MCP 协议驱动，agent-native）**

- 链接：https://github.com/artokun/comfyui-mcp ｜ 镜像：https://github.com/sandyup/comfyui-mcp
- **定位**：Local-first 的 MCP Server + 侧边栏 Agent，让任意 LLM（Claude/ChatGPT/Gemini/本地 Ollama）用自然语言驱动 ComfyUI。
- **核心能力**：
  - 生成图像/视频/音频，**自动编写并运行工作流**
  - **在自然语言下实时编辑节点图**
  - 管理模型与自定义节点
  - 号称 178 个工具、36 个 AI skills、55 个安装包
- **关系**：「LLM 通过 MCP 工具调用主导 ComfyUI」的成熟范例。

**ImageMCP（轻量 MCP 桥）**

- 链接：https://github.com/AvidGameFan/ImageMCP
- **定位**：把 ComfyUI 包装成干净的 MCP 接口，让语言模型在对话中按需生成图像。
- **关系**：结构清晰、轻量，适合作为**自研中间编排层的参考实现**。

### 6.2 LLM 辅助 ComfyUI（prompt / 工作流生成）

| 项目 | 链接 | 说明 |
|---|---|---|
| **ComfyUI-Copilot**（阿里系） | https://github.com/ATH-MaaS/ComfyUI-Copilot | 工作流构建辅助、ComfyUI 问答、**参数优化与迭代**、节点推荐、模型查询 |
| **comfyui-prompt-generator** | https://github.com/nichiki/comfyui-prompt-generator | 用 LLM（GPT-4o/Claude/Gemini）生成高质量 prompt，支持自然语言与 tag 风格 |

### 6.3 草图 → 出图（ControlNet 方向，不含 LLM）

| 项目 | 链接 | 说明 |
|---|---|---|
| **sketch-to-image-ai** | https://github.com/zlxi02/sketch-to-image-ai | 全栈 Web 应用，用 SD + ControlNet 把草图转真实图像，**完全本地运行**；可作改造底座 |
| **ComfyUI-Olm-Sketch** | https://github.com/o-l-l-i/ComfyUI-Olm-Sketch | ComfyUI 内**轻量绘图节点**，直接在节点图里手绘，专为 ControlNet scribble / i2i 设计 |
| **ControlNet-Sketch-Generator** | https://github.com/ywen-huang/ControlNet-Sketch-Generator | 逆向方向（图→草图），training-free，可控性技巧可参考 |

### 6.4 其他相关 MCP 生图项目

| 项目 | 链接 | 说明 |
|---|---|---|
| **Stability AI MCP Server** | https://github.com/tadasant/mcp-server-stability-ai | 连 Stability 官方 REST API（非本地），架构参考价值 |
| **stablemcp** | https://github.com/mkm29/stablemcp | 简单 MCP Server，JSON-RPC 2.0，轻量范例 |

### 6.5 关键结论

**没有一个项目同时完整覆盖全部四点，但每一环都有成熟开源实现，拼装即可。**

```
草图 → LLM识图理解 → LLM出参数/prompt → 驱动ComfyUI(ControlNet) → 出图
 ①           ②                    ③                  ④
```

| 环节 | 现成可复用的项目 |
|---|---|
| ① 草图输入 | **ComfyUI-Olm-Sketch**（内置手绘） |
| ② LLM 识图 | **comfyui_LLM_party**（多模态节点） |
| ③ LLM 工具调用/主导 | **comfyui-mcp** / **ImageMCP**（MCP 工具化） |
| ④ 草图→ControlNet 出图 | **sketch-to-image-ai** / 标准 ControlNet 工作流 |

> 方案已被大量项目验证可行，但没有「一站式成品」—— 这正是集成价值与差异化所在。

---

## 七、落地建议与路线

### 7.1 最小可行实现（MVP）

1. **ComfyUI 侧**：搭固定工作流

   ```
   草图上传 → ControlNet(lineart/scribble) + 图生图(VAE Encode) → KSampler → VAE Decode → 保存
   ```

   导出为 API JSON，确认参数槽位。

2. **中间编排层**（Python/Node 轻服务，约 200 行）：
   - 接收草图 + 用户意图文字；
   - 调 LLM 多模态：传入草图，要求输出工具参数 JSON；
   - 填充工作流模板 → 调 ComfyUI `/prompt`；
   - 轮询 `/history` → 回传成品图。

3. **LLM 接入**：MVP 阶段用 Claude/GPT-4o vision API + function call；后续可换 Qwen2.5-VL 自建。

4. **控制点调优**：ControlNet strength 0.6–0.9、denoise 0.5–0.7 是草图主导的甜点区间。

### 7.2 结合开源项目的路线

1. **先精读 `comfyui_LLM_party`**：看它如何做「LLM 识图 → 工具调用 → 图像流程」；
2. **参考 `comfyui-mcp` 的工具设计**：理解「LLM 如何用 MCP/function call 主导 ComfyUI」；
3. **以 `sketch-to-image-ai` 为草图→出图底座**，在其上加 LLM 识图层；
4. **用 `ComfyUI-Olm-Sketch` 思路**优化草图输入体验（可选）；
5. **自己写薄编排层**，把 ②③④ 串起来。

### 7.3 硬件与模型选型（RTX 4060 Laptop 8GB）

- **MVP 阶段**：SD 1.5 + lineart/scribble ControlNet（显存余量足、生态最全、推理快）
- **验证跑通后**：如需更高画质，SDXL + fp8 + Tiled VAE 作为可选「高质量模式」
- **中间编排层留出** `model` 和 `resolution` 参数槽位，平滑切换底模

---

## 八、总结

**可行性**

ComfyUI 的 API-mode 工作流 + ControlNet 提供「草图主导构图」的能力，多模态 LLM 通过 function call 提供「识图 + 主导风格描述」的能力，二者用一层薄编排层缝合即为完整方案 —— 技术上无硬卡点，推荐先以「模板工作流 + LLM 填参」的 MVP 验证。

**模型选型**

SD 主线为 1.x → 2.x → SDXL → SD3/3.5。SD1.5 生态最全、SDXL 画质与 ControlNet 兼顾最好；SD3 文本理解更强但 ControlNet 生态尚弱。8GB 显存下首推 SD1.5，SDXL 需优化加持。

**开源现状**

市面已有大量相关项目，但呈「各管一段」格局：`comfyui_LLM_party` 最接近完整目标，`comfyui-mcp`/`ImageMCP` 提供 LLM 工具化驱动 ComfyUI 的成熟范式，`sketch-to-image-ai` 提供草图→ControlNet 出图的本地底座 —— 无需从零发明，选 2–3 个缝合即可。且没有任何成品完整覆盖「LLM 识图主导草图语义」这一环，这正是差异化价值所在。

**推荐落地路径**

```
WebUI 搭工作流并调优 → 导出 API JSON 模板
    → 写薄编排层（上传草图 + LLM 识图出参 + 填模板 + POST /prompt + 取结果）
        → SD1.5 + ControlNet 起步，跑通后可选 SDXL 高质量模式
```
