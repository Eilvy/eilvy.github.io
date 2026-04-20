---
title: 'Golang - interface数据结构解析'
description: '深入了解 interface 数据结构，以及常规用法'
pubDate: 2026-04-20
tags: ['Golang', '数据结构']
categories: ['开发语言']
heroImage: '../../assets/blog-placeholder-3.jpg'
author: 'eilvy'
---



> 在计算机科学中，接口是计算机系统中多个组件共享的边界，不同的组件能够在边界上交换信息接口的本质是引入一个新的中间层，调用方可以通过接口与具体实现分离，解除上下游的耦合，上层的模块不再需要依赖下层的具体模块，只需要依赖一个约定好的接口。

## interface使用与隐式调用

声明interface

```go
// “动物”接口
type Anim interface{
    Spark()		//无返回值
    DoSth() string		//有返回值
    ...
}
```

创建结构体Cat

```go
type Cat struct{
	Name string
}
// 实现Spark方法
func (c *Cat) Spark(){
    fmt.Println("Meow")
}
// 实现DoSth方法
func (c *Cat) DoSth() string{
    return "walk"
}
```

对于实现了Spark，DoSth方法的结构体Cat来说，此时就可认为实现了Anim接口

上述描述即是**interface的隐式实现**

隐式实现是相对于显示实现来说的，例如Java，C#来说就是**显示实现**接口，例如：

```java
public interface MyInterface {
    public String hello = "Hello";
    public void sayHello();
}

public class MyInterfaceImpl implements MyInterface {
    public void sayHello() {
        System.out.println(MyInterface.hello);
    }
}
```

借此引申出**隐式调用**

相较于隐式实现，隐式调用针对的对象不同：隐式实现-->构造的结构体，隐式调用-->接口

对于接口而言，方法的调用过程是隐式的：
- 编译时：只知道 anim 是 Anim 类型
- **运行时**：根据 anim 实际存储的类型（ *Cat ）动态绑定到对应的 Spark() 方法



Go 的接口隐式实现规则：

- "如果它走起来像鸭子，叫起来像鸭子，那它就是鸭子"
- 只要类型实现了接口的所有方法，就自动实现该接口
- 调用时根据接口变量实际存储的类型动态绑定方法

隐式实现的优势在于：

- 解耦合 ：类型不需要知道接口的存在
- 灵活性 ：可以为第三方类型实现接口
- 简洁 ：不需要重复声明



## 等待补充。。。