# 最后防线：3D 无限尸潮

一款使用 Three.js 制作的浏览器 3D 上帝视角塔防游戏。修筑模块化防线、指挥士兵，在不断增强的无限尸潮中尽可能坚持更久。

主页提供两个独立模式：

- 无限金币：资源不减少，适合自由建造和测试阵型。
- 有限金币：初始 500 废料，通过击杀获取资源。

两个模式分别保存并展示最高生存波数。

主页右上角和游戏顶部均提供 `EN / 中` 按钮，可随时切换简体中文与英文；语言选择保存在本机。

主页另有可关闭的双语“游戏指南 / GUIDE”面板，集中说明模式、镜头、士兵部署与命令、建造、城门、资源、尸潮和胜负条件。指南内容可滚动并适配小屏幕。

## 运行

需要 Node.js 20.19 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开终端中显示的本地地址即可游玩。生产构建使用 `npm run build`，测试使用 `npm test`。

## 完全离线使用

执行一次 `npm run build` 后，直接双击 [`dist/index.html`](dist/index.html) 即可游玩。这个文件已经内嵌全部程序和样式，不需要网络、服务器或安装依赖，也不会请求在线字体或素材。可以把该 HTML 文件复制到其他 Windows 电脑使用。

## 操作

- `WASD` / 方向键：移动上帝视角
- `Q` / `E`：旋转视角
- 按住鼠标右键拖动：旋转并俯仰观看角度（拖动超过阈值后只控制镜头）
- 鼠标滚轮：缩放
- `H`：回到基地
- 左键拖动：框选士兵；左键单击士兵：选择单个士兵（按住 `Shift` 可多选）
- 选中士兵后左键单击战场空地：让所有已选士兵移动并在目标附近列阵防守
- 短按右键：让所选士兵前往指定位置并列阵防守
- 左键点击已建成的城门：打开或关闭；打开时丧尸可通过，关闭时阻挡丧尸
- `1` / `2` / `3`：进攻、防御、撤退
- `4`—`9`：快速选择防线；`B` / `Esc` 取消建造
- 从右侧兵种栏拖动士兵到基地外空地进行部署，也可先点兵种再点地图
- `空格`：暂停

## 玩法

- 尸潮从六个方向无限出现；每波丧尸总数都会平滑增加，普通、疾跑和坦克丧尸也会随波次增强。
- Endless hordes attack from six directions; every wave steadily adds more zombies while all enemy types grow stronger.
- 消灭丧尸获得废料，使用废料建造墙、机枪塔、狙击塔、迫击炮、减速网、地雷、路障、城门和维修站。
- 混凝土墙消耗 35 废料，拥有 600 耐久，只负责可靠阻挡且不造成伤害；铁丝路障消耗 25 废料，拥有 230 耐久，较脆但会对贴近的丧尸每 0.5 秒造成 5 点伤害。
- 城门消耗 120 废料，拥有 480 耐久，占据 2×1 网格。关闭时参与阻挡和流场寻路，打开时释放通路；若关闭会切断任一出生点到基地的唯一通路，操作会被拒绝。
- 盾兵是高耐久近战前排，盾牌会降低来自正面的丧尸伤害，适合掩护远程士兵。
- 维修站会周期性修复范围内建筑并治疗士兵；工程兵也可修复附近防线，医疗兵负责治疗友军。
- 防线可以自由组合，但系统不允许完全封死所有出生点到基地的通路。
- 士兵不会自动生成；部署会消耗废料。进攻姿态会主动追击，右键可指定防守阵地，撤退命令会令其优先返回最近防线后方（没有防线时返回基地）。
- 提前迎战可获得额外废料；基地归零后，本机将保存最高波次。

## Controls (English)

- Hold and drag RMB to orbit/tilt the camera; a short RMB click still assigns a defensive position.
- Left-click a completed gate to open or close it. Open gates allow passage; closed gates block zombies and update pathfinding.
- Concrete Wall: 35 scrap, 600 HP, pure blocking with no damage.
- Wire Barrier: 25 scrap, 230 HP, and deals 5 damage every 0.5 seconds to adjacent zombies.
- Gate: 120 scrap, 480 HP, 2×1 grid. Closing is refused if it would cut off any spawn route.
