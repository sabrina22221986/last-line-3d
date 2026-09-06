# 最后防线：3D 无限尸潮

一款使用 Three.js 制作的浏览器 3D 上帝视角塔防游戏。修筑模块化防线、指挥士兵，在不断增强的无限尸潮中尽可能坚持更久。

主页提供两个独立模式：

- 无限金币：资源不减少，适合自由建造和测试阵型。
- 有限金币：初始 500 废料，通过击杀获取资源。

两个模式分别保存并展示最高生存波数。

主页右上角和游戏顶部均提供 `EN / 中` 按钮，可随时切换简体中文与英文；语言选择保存在本机。

主页在两个模式入口下方直接展示完整的双语“游戏指南 / GUIDE”，集中说明模式、镜头、士兵部署与命令、建造、城门、资源、尸潮和胜负条件。主页可滚动并适配桌面与小屏幕，模式入口始终优先展示。

## 运行

需要 Node.js 20.19 或更高版本。

```bash
npm install
npm run dev
```

浏览器打开终端中显示的本地地址即可游玩。生产构建使用 `npm run build`，测试使用 `npm test`。

### iPad 通过局域网游玩

iPad 和电脑连接同一个 Wi‑Fi，建议先把 iPad 转为横屏，然后在 Windows 电脑上任选一种方式启动：

- 双击项目根目录的 `start-lan.cmd`；首次运行会自动安装依赖。
- 或在终端执行 `npm run dev:lan`。

保持终端窗口开启，在输出的 `Network` 地址中选择电脑的局域网地址（例如 `http://192.168.1.20:5173/`），用 iPad Safari 打开。若 Windows 防火墙首次询问，请只允许当前受信任的“专用网络”；如果没有显示 `Network` 地址，可运行 `ipconfig` 查找当前 Wi‑Fi 的 IPv4 地址，再访问 `http://该地址:5173/`。

如需从生产构建提供服务，可先执行 `npm run build`，再执行 `npm run preview:lan`，并使用终端显示的局域网地址。

## 完全离线使用

执行一次 `npm run build` 后，直接双击 [`dist/index.html`](dist/index.html) 即可游玩。这个文件已经内嵌全部程序和样式，不需要网络、服务器或安装依赖，也不会请求在线字体或素材。可以把该 HTML 文件复制到其他 Windows 电脑使用。

该单文件继续面向桌面浏览器。iPadOS Safari /“文件”App 对 `file://` 本地 HTML、模块脚本和相关资源加载有沙盒限制，不能把“在文件中点开 HTML”视为可靠运行方式；iPad 请使用上面的同一 Wi‑Fi 局域网服务器方式，游戏内容本身无需公网。

## 操作

### iPad / 触摸

- 建议横屏，以获得完整按钮区和战场视野。
- 单指点模式卡进入游戏；点建筑后再点战场空地进行放置；再次点同一建筑可取消。
- 点兵种后再点基地外空地部署。触摸端不依赖 HTML5 拖拽。
- 单指点士兵进行选择，再点空地移动并列阵；点命令按钮切换进攻、防御或撤退。
- 单指点已建成的城门即可开关。
- 双指同时拖动：旋转与俯仰镜头；双指捏合：缩放。
- 游戏画布会阻止 Safari 页面滚动和缩放冲突；主页指南仍可单指上下滚动。

### 桌面

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
- 城门消耗 120 废料，拥有 480 耐久，占据 2×1 网格。关闭时参与阻挡和流场寻路，打开时释放通路；即使关闭后完全封路也允许操作。
- 盾兵是高耐久近战前排，盾牌会降低来自正面的丧尸伤害，适合掩护远程士兵。
- 维修站会周期性修复范围内建筑并治疗士兵；工程兵也可修复附近防线，医疗兵负责治疗友军。
- 墙、路障、塔和关闭的城门可以完全封死所有路线。丧尸会继续向基地推进，在接触阻挡建筑后攻击，摧毁后重新寻路并继续前进，不会卡死或穿墙。
- 士兵不会自动生成；部署会消耗废料。进攻姿态会主动追击，右键可指定防守阵地，撤退命令会令其优先返回最近防线后方（没有防线时返回基地）。
- 提前迎战可获得额外废料；基地归零后，本机将保存最高波次。

## Controls (English)

- iPad: landscape is recommended. Tap a mode to start; tap a defense then clear ground to build; tap a troop type then clear ground outside the base to deploy.
- Tap a soldier, then tap clear ground to move. Tap a completed gate to open or close it. Tap the order buttons for Attack, Defend, or Retreat.
- Two-finger drag orbits/tilts the camera; pinch zooms. Touch deployment does not rely on HTML5 drag-and-drop.
- To play on iPad without public internet, connect it to the same Wi-Fi as the PC, run `start-lan.cmd` or `npm run dev:lan`, and open the shown Network URL in Safari.
- The self-contained `dist/index.html` remains available for desktop offline use. iPadOS Safari/Files does not reliably run local `file://` HTML, so use the LAN server on iPad.
- Hold and drag RMB to orbit/tilt the camera; a short RMB click still assigns a defensive position.
- Left-click a completed gate to open or close it. Open gates allow passage; closed gates block zombies and update pathfinding.
- Concrete Wall: 35 scrap, 600 HP, pure blocking with no damage.
- Wire Barrier: 25 scrap, 230 HP, and deals 5 damage every 0.5 seconds to adjacent zombies.
- Walls, barriers, towers, and closed gates may seal every route. Zombies advance to the blocking structure, attack it, then recalculate their route and continue once it is destroyed.
- Gate: 120 scrap, 480 HP, 2×1 grid. It may be closed even when doing so seals the final route.
