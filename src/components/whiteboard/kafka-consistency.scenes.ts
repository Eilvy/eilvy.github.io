/**
 * 《Kafka 如何做到不丢不重》一文的画板场景集合。
 *
 * 覆盖文中的 5 张图：
 *   1. 三条投递语义（最多一次 / 至少一次 / 精确一次）各自会出什么问题
 *   2. 生产端不丢：acks=all + min.insync.replicas + HW 的关系
 *   3. 生产端不重：幂等生产者的 PID + 序列号去重
 *   4. 跨分区原子 + 消费端不重：事务与 read_committed
 *   5. 端到端「不丢不重」需要同时拧紧的所有开关
 *
 * 配色与布局件见 scene-kit.ts，绘制规范见 docs/WHITEBOARD_GUIDE.md。
 */

import { C, box, txt, vArrow, hFlow, arrowTo, groupFrame, type El } from './scene-kit';

/* ─────────────────────────────────────────────
 * 一、三条投递语义
 *
 * 三列并排对比，每列从上到下是「生产者 → broker → 消费者」，
 * 底部给出该语义的后果。用颜色区分「安全」与「有问题」。
 * ───────────────────────────────────────────── */
export const deliverySemanticsScene: El[] = [
	txt(30, 30, '三条投递语义：各自会出什么问题', 22),
	txt(32, 68, '「不丢」和「不重」是两个独立问题，要分别解决', 13, C.muted),

	// ── 三列表头
	box(30, 110, 220, 52, '最多一次 at-most-once', C.warn, 14),
	box(280, 110, 220, 52, '至少一次 at-least-once', C.control, 14),
	box(530, 110, 220, 52, '精确一次 exactly-once', C.output, 14),

	// ── 每列的内部流程
	box(30, 182, 220, 46, '先提交 offset\n再处理消息', C.neutral, 12),
	box(280, 182, 220, 46, '先处理消息\n再提交 offset', C.neutral, 12),
	box(530, 182, 220, 46, '处理与 offset 提交\n在同一事务里', C.neutral, 12),

	vArrow(140, 228, 262),
	vArrow(390, 228, 262),
	vArrow(640, 228, 262),

	box(30, 262, 220, 60, '处理中崩溃\n→ 消息永久丢失', C.warn, 12),
	box(280, 262, 220, 60, '提交前崩溃\n→ 消息被重复处理', C.warn, 12),
	box(530, 262, 220, 60, '两者要么都生效\n要么都不生效', C.output, 12),

	// ── 底部结论
	txt(30, 360, '关键认知：', 15),
	txt(30, 392, '· 「至少一次」是 Kafka 的默认行为 —— 不丢，但可能重', 13, C.muted),
	txt(30, 416, '· 要做到「精确一次」，必须叠加幂等生产者 + 事务，光靠配置 acks 不够', 13, C.muted),
	txt(30, 440, '· 所谓 exactly-once 是 Kafka 内部端到端的语义，写出到外部系统仍需幂等', 13, C.emphasis),
];

/* ─────────────────────────────────────────────
 * 二、生产端不丢：acks=all 与 ISR 的关系
 *
 * 重点讲清一个常见误解：acks=all 不是「等所有副本」，
 * 而是「等当前 ISR 里的副本」—— ISR 会缩水，所以要配 min.insync.replicas。
 * ───────────────────────────────────────────── */
export const producerDurabilityScene: El[] = [
	txt(30, 30, '生产端不丢：acks=all 到底在等谁', 22),
	txt(32, 68, 'acks=all 等的是「当前 ISR」，不是「全部副本」', 13, C.muted),

	/*
	 * 布局取舍：两个 Follower 竖直堆叠、Leader 独占左侧，
	 * 这样「每个 Follower 都从 Leader 拉取」可以画成两条独立的短箭头。
	 * 首版把三个副本并排一行，结果 fetch 箭头只能横跨整个 Follower 方框
	 * （起点误用了方框右边缘），线条直接穿过方框里的文字 —— 已改掉。
	 */
	txt(30, 104, '正常：ISR = 3 个副本', 14),
	groupFrame(30, 126, 620, 180),
	box(50, 146, 180, 140, 'Leader\nLEO=105\nHW=100', C.kafkaBroker, 13),
	box(370, 146, 240, 62, 'Follower 1\n已同步到 100', C.kafkaBroker, 12),
	box(370, 224, 240, 62, 'Follower 2\n已同步到 100', C.kafkaBroker, 12),
	hFlow(230, 370, 177, C.muted, 'fetch'),
	hFlow(230, 370, 255, C.muted, 'fetch'),

	// 生产者写入 Leader（斜箭头指向 Leader 底边）
	box(50, 340, 180, 56, '生产者写入\nacks=all', C.kafkaProducer, 12),
	arrowTo(230, 368, 140, 286, C.stroke, '写入'),

	txt(370, 330, 'HW = min(所有 ISR 的 LEO) = 100，消费者只能读到 100', 12, C.muted),
	txt(370, 356, 'min.insync.replicas=2 时，3 个副本里至少 2 个确认才算写入成功', 12, C.muted),

	// ── 危险情况
	txt(30, 424, '危险：Follower 掉队，ISR 缩水成 1', 14),
	groupFrame(30, 446, 620, 130),
	box(50, 470, 180, 90, 'Leader\nISR 只剩自己', C.warn, 12),
	box(260, 470, 180, 90, 'Follower 1\n已掉出 ISR', C.neutral, 12),
	box(470, 470, 180, 90, 'Follower 2\n已掉出 ISR', C.neutral, 12),

	txt(30, 604, '此时 acks=all 只等 Leader 自己 —— 没有 min.insync.replicas 就等于没保护', 13, C.emphasis),
	txt(30, 632, '配上 min.insync.replicas=2 后，ISR 不足 2 个时写入直接报错，宁可不可用也不丢数据', 13, C.muted),
];

/* ─────────────────────────────────────────────
 * 三、生产端不重：幂等生产者
 * ───────────────────────────────────────────── */
export const idempotentProducerScene: El[] = [
	txt(30, 30, '生产端不重：幂等生产者怎么去重', 22),
	txt(32, 68, 'PID + 分区级序列号，让 Broker 认出「这是同一条」', 13, C.muted),

	// ── 首次发送
	txt(30, 104, '第一次发送', 14),
	box(30, 130, 180, 70, 'Producer\nPID=7, seq=0', C.kafkaProducer, 12),
	arrowTo(210, 165, 330, 165, C.stroke, '① 发送'),
	box(330, 130, 180, 70, 'Broker\n记录 (7, 0)', C.kafkaBroker, 12),
	arrowTo(510, 165, 620, 165, C.stroke, '② 落盘'),
	box(620, 130, 130, 70, '写入成功', C.output, 12),

	// ── 响应丢失
	txt(30, 230, '响应在回程丢了，生产者以为失败 → 重试', 14, C.muted),
	box(30, 258, 180, 70, 'Producer\n重试 PID=7, seq=0', C.kafkaProducer, 12),
	arrowTo(210, 293, 330, 293, C.emphasis, '③ 重试'),
	box(330, 258, 180, 70, 'Broker\n已见过 (7, 0)', C.kafkaBroker, 12),
	arrowTo(510, 293, 620, 293, C.emphasis, '④ 丢弃'),
	box(620, 258, 130, 70, '不重复写入', C.output, 12),

	// ── 结论
	txt(30, 360, '要点：', 15),
	txt(30, 392, '· PID 标识生产者实例，seq 在该 PID 的每个分区上单调递增', 13, C.muted),
	txt(30, 416, '· Broker 为每个 (PID, 分区) 记住最近一个 seq，重复的直接丢弃', 13, C.muted),
	txt(30, 440, '· Kafka 3.0 起 enable.idempotence 默认 true（同时强制 acks=all）', 13, C.muted),
	txt(30, 464, '· 幂等只保证「单生产者、单分区、单会话内」不重 —— 跨分区/重启要靠事务', 13, C.emphasis),
];

/* ─────────────────────────────────────────────
 * 四、事务：跨分区原子 + 消费端 read_committed
 * ───────────────────────────────────────────── */
export const transactionScene: El[] = [
	txt(30, 30, '事务：跨分区原子写入与消费端隔离', 22),
	txt(32, 68, '把「写多个分区」和「提交 offset」打包成一个原子单元', 13, C.muted),

	// ── 协调者与两阶段
	txt(30, 104, '事务协调者（两阶段提交）', 14),
	box(30, 130, 620, 56, '① InitProducerId 拿 PID → ② AddPartitionsToTxn 登记分区 → ③ 写数据（此时对 read_committed 不可见）', C.kafkaTxn, 12),
	box(30, 194, 300, 56, '④ EndTxn(commit)\n协调者写 COMMIT 标记', C.kafkaTxn, 12),
	box(350, 194, 300, 56, '若中途失败\n协调者写 ABORT 标记', C.warn, 12),

	// ── 写入的两个分区 + offset
	box(30, 280, 200, 70, '__transaction_state\n协调者自己的状态日志', C.neutral, 12),
	box(245, 280, 190, 70, '业务 topic\n分区 A / B', C.kafkaBroker, 12),
	box(450, 280, 200, 70, '__consumer_offsets\n消费位移也纳入事务', C.kafkaConsumer, 12),

	txt(30, 372, '这三处的写入要么全部生效、要么全部回滚 —— 这就是「跨分区原子」', 13, C.muted),

	// ── 消费端隔离
	txt(30, 420, '消费端：isolation.level 决定读到什么', 14),
	box(30, 448, 300, 86, 'read_committed（推荐）\n只读到 LSO 之前的已提交消息\n未提交/已回滚的自动过滤掉', C.output, 12),
	box(350, 448, 300, 86, 'read_uncommitted（默认）\n不等待事务，先读为敬\n可能读到后来被回滚的消息', C.warn, 12),

	txt(30, 560, 'LSO（Last Stable Offset）= 第一个未结束事务的起始位置；read_committed 不会读到 LSO 及其之后', 12, C.muted),
	txt(30, 586, '注意：事务解决的是「Kafka 内部」的端到端一致性，写外部数据库仍要自己保证幂等', 13, C.emphasis),
];

/* ─────────────────────────────────────────────
 * 五、端到端清单
 *
 * 生产端 / Broker / 消费端三段，各列出必须拧紧的开关。
 * ───────────────────────────────────────────── */
export const endToEndScene: El[] = [
	txt(30, 30, '端到端不丢不重：需要同时拧紧的开关', 22),
	txt(32, 68, '任何一环漏掉，前功尽弃', 13, C.muted),

	// ── 生产端
	txt(30, 100, '生产端', 15),
	groupFrame(30, 122, 200, 210),
	box(42, 140, 176, 40, 'acks=all', C.kafkaProducer, 12),
	box(42, 188, 176, 40, 'enable.idempotence=true', C.kafkaProducer, 11),
	box(42, 236, 176, 40, 'retries 足够大', C.kafkaProducer, 12),
	box(42, 284, 176, 40, 'delivery.timeout 合理', C.kafkaProducer, 12),

	// ── Broker
	txt(255, 100, 'Broker / Topic', 15),
	groupFrame(255, 122, 200, 210),
	box(267, 140, 176, 40, 'replication.factor ≥ 3', C.kafkaBroker, 12),
	box(267, 188, 176, 40, 'min.insync.replicas ≥ 2', C.kafkaBroker, 11),
	box(267, 236, 176, 40, 'unclean 选举 = false', C.kafkaBroker, 12),
	box(267, 284, 176, 40, '事务：transaction.state.log\n副本数 ≥ 3', C.kafkaBroker, 10),

	// ── 消费端
	txt(480, 100, '消费端', 15),
	groupFrame(480, 122, 200, 210),
	box(492, 140, 176, 40, '关闭自动提交', C.kafkaConsumer, 12),
	box(492, 188, 176, 40, '处理完再提交 offset', C.kafkaConsumer, 12),
	box(492, 236, 176, 40, 'isolation.level=\nread_committed', C.kafkaConsumer, 11),
	box(492, 284, 176, 40, '业务侧幂等（去重表）', C.kafkaConsumer, 12),

	// ── 底部
	txt(30, 372, '三端是「与」的关系，不是「或」：', 14),
	txt(30, 404, '· 生产端漏了幂等 → 重试会写出重复消息', 13, C.muted),
	txt(30, 428, '· Broker 漏了 min.insync.replicas → acks=all 形同虚设', 13, C.muted),
	txt(30, 452, '· 消费端漏了手动提交 → 崩溃后重复消费', 13, C.muted),
	txt(30, 484, '另外：unclean.leader.election.enable=true 会在 ISR 全挂时用落后副本顶上 —— 可用性换数据，必丢', 13, C.emphasis),
];
