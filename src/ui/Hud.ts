import { BUILDINGS, SOLDIERS } from '../game/config';
import type { BuildingKind, GameMode, GameSnapshot, Language, SoldierKind, Stance } from '../game/types';

const BUILDING_EN: Record<BuildingKind, [string, string]> = {
  wall: ['Concrete Wall', '35 scrap / 600 HP: durable pure blocker; deals no damage'],
  machinegun: ['MG Turret', 'Rapid anti-horde fire'],
  sniper: ['Sniper Tower', 'Long-range precision fire'],
  cannon: ['Mortar', 'Area explosive damage'],
  slow: ['Slow Field', 'Slows nearby enemies'],
  mine: ['Claymore', 'Single-use area blast'],
  barricade: ['Wire Barrier', '25 scrap / 230 HP: adjacent zombies take 5 damage every 0.5s'],
  gate: ['Gate', '120 scrap / 480 HP: click to open/close; blocks only while closed'],
  repair: ['Repair Hub', 'Repairs structures and heals troops'],
};
const SOLDIER_EN: Record<SoldierKind, [string, string]> = {
  assault: ['Assault', 'Balanced frontline soldier'],
  gunner: ['Gunner', 'High-rate crowd suppression'],
  sniper: ['Sniper', 'Long-range high-value hunter'],
  rocketeer: ['Rocketeer', 'Rockets damage a one-grid radius'],
  medic: ['Medic', 'Heals nearby allies'],
  engineer: ['Engineer', 'Repairs nearby defenses'],
  shield: ['Shield Trooper', 'Slow armored frontliner; shield reduces frontal zombie damage'],
};

export interface HudActions {
  onBuild: (kind: BuildingKind | null) => void;
  onStance: (stance: Stance) => void;
  onPause: () => void;
  onSpeed: () => void;
  onWave: () => void;
  onRestart: () => void;
  onHome: () => void;
  onStartMode: (mode: GameMode) => void;
  onRecruit: (kind: SoldierKind) => void;
  onRecruitDragEnd: () => void;
  onLanguage: () => void;
}

export class Hud {
  private root: HTMLElement;
  private stats: HTMLElement;
  private selection: HTMLElement;
  private waveStatus: HTMLElement;
  private buildButtons = new Map<BuildingKind, HTMLButtonElement>();
  private recruitButtons = new Map<SoldierKind, HTMLButtonElement>();
  private activeBuild: BuildingKind | null = null;
  private language: Language = 'zh';
  private lastSnapshot?: GameSnapshot;

  constructor(actions: HudActions) {
    const root = document.createElement('div');
    root.className = 'hud';
    root.innerHTML = `
      <header class="topbar glass">
        <div class="brand"><span class="brand-mark">Λ</span><div><b data-zh="最后防线" data-en="LAST LINE">最后防线</b><small>LAST LINE // ZONE 07</small></div></div>
        <div id="stats" class="stats"></div>
        <div class="top-actions">
          <button data-action="language" title="中文 / English">EN</button>
          <button data-action="home" title="返回模式主页">⌂</button>
          <button data-action="pause" title="暂停 (空格)">Ⅱ</button>
          <button data-action="speed" title="游戏速度">1×</button>
        </div>
      </header>
      <aside class="mission glass">
        <div class="eyebrow" data-zh="作战状态" data-en="OPERATION STATUS">作战状态</div>
        <div id="waveStatus" class="wave-status">侦测尸潮中</div>
        <div class="objective"><span data-zh="主要目标" data-en="PRIMARY OBJECTIVE">主要目标</span><b data-zh="守住核心基地" data-en="DEFEND THE CORE">守住核心基地</b></div>
        <button class="wave-button" data-action="wave" data-zh="提前迎战 +资源" data-en="CALL WAVE +SCRAP">提前迎战 +资源</button>
      </aside>
      <section class="build-panel glass">
        <div class="panel-title"><span data-zh="建造防线" data-en="BUILD DEFENSES">建造防线</span><small data-zh="B 取消 · R 旋转" data-en="B CANCEL · R ROTATE">B 取消 · R 旋转</small></div>
        <div id="buildGrid" class="build-grid"></div>
      </section>
      <section class="orders glass">
        <div id="selection" class="selection-info">未选择士兵</div>
        <div class="order-buttons">
          <button data-stance="attack"><b>⚔</b><span><i data-zh="进攻" data-en="ATTACK">进攻</i><small>1</small></span></button>
          <button data-stance="defend"><b>⬡</b><span><i data-zh="防御" data-en="DEFEND">防御</i><small>2</small></span></button>
          <button data-stance="retreat"><b>↙</b><span><i data-zh="撤退" data-en="RETREAT">撤退</i><small>3</small></span></button>
        </div>
      </section>
      <section class="recruit-panel glass">
        <div class="panel-title"><span data-zh="拖拽部署士兵" data-en="DRAG TO DEPLOY">拖拽部署士兵</span><small data-zh="拖到基地外空地" data-en="DROP OUTSIDE THE BASE">拖到基地外空地</small></div>
        <div id="recruitGrid" class="recruit-grid"></div>
      </section>
      <div class="controls-hint glass">
        <span><i>WASD</i> <b data-zh="移动视角" data-en="MOVE CAMERA">移动视角</b></span>
        <span><i data-zh="左键空地" data-en="LMB GROUND">左键空地</i> <b data-zh="移动士兵" data-en="MOVE TROOPS">移动士兵</b></span>
        <span><i data-zh="右键短按" data-en="RMB CLICK">右键短按</i> <b data-zh="指定防守" data-en="DEFEND HERE">指定防守</b></span>
        <span><i data-zh="右键拖动" data-en="RMB DRAG">右键拖动</i> <b data-zh="旋转 / 俯仰" data-en="ORBIT / TILT">旋转 / 俯仰</b></span>
        <span><i data-zh="左键城门" data-en="LMB GATE">左键城门</i> <b data-zh="开关城门" data-en="OPEN / CLOSE">开关城门</b></span>
        <span><i data-zh="左键拖动" data-en="LMB DRAG">左键拖动</i> <b data-zh="框选" data-en="SELECT">框选</b></span>
        <span><i data-zh="滚轮" data-en="WHEEL">滚轮</i> <b data-zh="缩放" data-en="ZOOM">缩放</b></span>
      </div>
      <div id="toast" class="toast"></div>
      <div id="homeScreen" class="overlay home-screen">
        <button class="home-language" data-action="language">EN</button>
        <div class="home-content">
          <div class="home-kicker">LAST LINE // ZONE 07</div>
          <h1 data-zh="最后防线" data-en="LAST LINE">最后防线</h1>
          <p data-zh="修筑防线，抵抗规模逐波平滑增长的无尽尸潮" data-en="Build defenses and survive an endless horde that grows steadily every wave">修筑防线，抵抗规模逐波平滑增长的无尽尸潮</p>
          <div class="mode-grid">
            <button class="mode-card infinite" data-mode="infinite">
              <span class="mode-icon">∞</span><small data-zh="沙盒模式" data-en="SANDBOX">沙盒模式</small><b data-zh="无限金币" data-en="UNLIMITED COINS">无限金币</b>
              <p data-zh="资源无限，自由建造并测试任何防线" data-en="Unlimited resources. Build and test any defense.">资源无限，自由建造并测试任何防线</p>
              <em><span data-zh="最高生存" data-en="BEST SURVIVAL">最高生存</span> <strong id="highInfinite">0</strong> <span data-zh="波" data-en="WAVES">波</span></em>
            </button>
            <button class="mode-card survival" data-mode="survival">
              <span class="mode-icon">◈</span><small data-zh="标准模式" data-en="SURVIVAL">标准模式</small><b data-zh="有限金币" data-en="LIMITED COINS">有限金币</b>
              <p data-zh="初始 500 废料，击杀丧尸获取更多资源" data-en="Start with 500 scrap. Earn more by eliminating zombies.">初始 500 废料，击杀丧尸获取更多资源</p>
              <em><span data-zh="最高生存" data-en="BEST SURVIVAL">最高生存</span> <strong id="highSurvival">0</strong> <span data-zh="波" data-en="WAVES">波</span></em>
            </button>
          </div>
          <button class="guide-open" data-action="guide">
            <span>?</span><b data-zh="游戏指南" data-en="GAME GUIDE">游戏指南</b><small>GUIDE</small>
          </button>
          <div class="home-tip" data-zh="两种模式的最高波数分别保存" data-en="BEST WAVES ARE SAVED SEPARATELY">两种模式的最高波数分别保存</div>
        </div>
      </div>
      <div id="guidePanel" class="overlay guide-overlay hidden" role="dialog" aria-modal="true" aria-labelledby="guideTitle">
        <article class="guide-panel glass">
          <header class="guide-header">
            <div><div class="eyebrow">FIELD MANUAL // GUIDE</div><h2 id="guideTitle" data-zh="游戏指南" data-en="GAME GUIDE">游戏指南</h2></div>
            <button class="guide-close" data-action="guide-close" aria-label="关闭 / Close">×</button>
          </header>
          <div class="guide-scroll">
            <section>
              <h3><i>01</i><span data-zh="模式与目标" data-en="MODES & OBJECTIVE">模式与目标</span></h3>
              <p data-zh="无限金币是自由建造的沙盒模式；有限金币以 500 废料开局，部署和建造都消耗资源。两种模式都是无尽尸潮，没有最终波次：基地生命归零即失败，尽可能刷新各模式独立保存的最高波数。" data-en="Unlimited Coins is a sandbox for free building. Limited Coins starts with 500 scrap, spent on troops and defenses. Both modes are endless with no final wave: you lose when base health reaches zero, so push the separately saved best wave for each mode.">无限金币是自由建造的沙盒模式；有限金币以 500 废料开局，部署和建造都消耗资源。两种模式都是无尽尸潮，没有最终波次：基地生命归零即失败，尽可能刷新各模式独立保存的最高波数。</p>
            </section>
            <section>
              <h3><i>02</i><span data-zh="镜头操作" data-en="CAMERA">镜头操作</span></h3>
              <p data-zh="使用 WASD 或方向键平移，Q / E 旋转；按住右键拖动可旋转并俯仰镜头，滚轮缩放，H 回到基地。空格暂停，顶部速度按钮切换游戏速度。" data-en="Use WASD or arrows to pan and Q / E to rotate. Hold and drag RMB to orbit and tilt, use the wheel to zoom, and H to return to base. Space pauses; the top button changes speed.">使用 WASD 或方向键平移，Q / E 旋转；按住右键拖动可旋转并俯仰镜头，滚轮缩放，H 回到基地。空格暂停，顶部速度按钮切换游戏速度。</p>
            </section>
            <section>
              <h3><i>03</i><span data-zh="部署、选中与移动" data-en="DEPLOY, SELECT & MOVE">部署、选中与移动</span></h3>
              <p data-zh="从右侧兵种栏拖到基地外空地部署，也可先点兵种再点地图。左键单击士兵进行选择，Shift 可多选；左键拖动可框选。选中后左键点击空地会移动并列阵，短按右键则指定防守阵地。" data-en="Drag troops from the right roster onto clear ground outside the base, or click a troop then the map. Left-click to select; hold Shift for multi-select, or drag a box. Left-click ground to move and form up; a short RMB click sets a defensive position.">从右侧兵种栏拖到基地外空地部署，也可先点兵种再点地图。左键单击士兵进行选择，Shift 可多选；左键拖动可框选。选中后左键点击空地会移动并列阵，短按右键则指定防守阵地。</p>
            </section>
            <section>
              <h3><i>04</i><span data-zh="作战命令" data-en="COMBAT ORDERS">作战命令</span></h3>
              <p data-zh="按 1 进攻：主动追击敌人；按 2 防守：守住当前或指定位置；按 3 撤退：优先退到最近防线后方，没有防线时返回基地。盾兵擅长承受伤害，可用于保护后排。" data-en="Press 1 to Attack and pursue enemies; 2 to Defend the current or assigned position; 3 to Retreat behind the nearest defense, or back to base if none exists. Shield troops absorb damage well and can protect the back line.">按 1 进攻：主动追击敌人；按 2 防守：守住当前或指定位置；按 3 撤退：优先退到最近防线后方，没有防线时返回基地。盾兵擅长承受伤害，可用于保护后排。</p>
            </section>
            <section>
              <h3><i>05</i><span data-zh="建造与城门" data-en="BUILDING & GATES">建造与城门</span></h3>
              <p data-zh="点击左下建造项后在网格放置，R 旋转，B 或 Esc 取消；数字 4—9 可快速选择前六种防线。不可把所有出生点通往基地的道路完全封死。城门放置后，点击已建成的城门即可开关：关闭时阻挡，打开时允许通行。" data-en="Choose a defense at bottom-left and place it on the grid. R rotates; B or Esc cancels; keys 4–9 select the first six defenses. You cannot seal every route from spawns to the base. Click a built gate to toggle it: closed blocks passage, open allows movement.">点击左下建造项后在网格放置，R 旋转，B 或 Esc 取消；数字 4—9 可快速选择前六种防线。不可把所有出生点通往基地的道路完全封死。城门放置后，点击已建成的城门即可开关：关闭时阻挡，打开时允许通行。</p>
            </section>
            <section>
              <h3><i>06</i><span data-zh="资源与维修" data-en="RESOURCES & REPAIR">资源与维修</span></h3>
              <p data-zh="有限金币模式中，消灭丧尸可获得废料，提前呼叫下一波还能获得额外奖励。维修站会周期性修复范围内建筑并治疗士兵；工程兵也能修复附近防线，医疗兵负责治疗友军。" data-en="In Limited Coins, kills award scrap and calling the next wave early grants a bonus. Repair Hubs periodically repair nearby structures and heal troops; Engineers also repair defenses, while Medics heal allies.">有限金币模式中，消灭丧尸可获得废料，提前呼叫下一波还能获得额外奖励。维修站会周期性修复范围内建筑并治疗士兵；工程兵也能修复附近防线，医疗兵负责治疗友军。</p>
            </section>
            <section>
              <h3><i>07</i><span data-zh="尸潮情报" data-en="HORDE INTEL">尸潮情报</span></h3>
              <p data-zh="尸潮会从六个方向出现，每波数量持续增加，普通、疾跑和坦克丧尸也会逐渐增强。利用波次间隙补充士兵、维修并调整防线；提前迎战风险更高，但能更快积累资源。" data-en="Hordes arrive from six directions. Every wave adds enemies, while walkers, runners, and tanks grow stronger. Use breaks to deploy, repair, and reshape your line. Calling early is riskier but builds resources faster.">尸潮会从六个方向出现，每波数量持续增加，普通、疾跑和坦克丧尸也会逐渐增强。利用波次间隙补充士兵、维修并调整防线；提前迎战风险更高，但能更快积累资源。</p>
            </section>
          </div>
          <footer><span data-zh="守住核心基地，延长最后防线" data-en="HOLD THE CORE. EXTEND THE LAST LINE.">守住核心基地，延长最后防线</span></footer>
        </article>
      </div>
      <div id="gameOver" class="overlay hidden">
        <div class="game-over glass"><div class="eyebrow" data-zh="防线失守" data-en="LINE COLLAPSED">防线失守</div><h1 data-zh="基地已沦陷" data-en="BASE OVERRUN">基地已沦陷</h1>
          <p id="scoreLine"></p><button data-action="restart" data-zh="重建防线" data-en="REBUILD">重建防线</button></div>
      </div>
      <div class="vignette"></div>
    `;
    document.querySelector('#app')?.appendChild(root);
    this.root = root;
    this.stats = root.querySelector('#stats')!;
    this.selection = root.querySelector('#selection')!;
    this.waveStatus = root.querySelector('#waveStatus')!;

    const buildGrid = root.querySelector('#buildGrid')!;
    (Object.entries(BUILDINGS) as [BuildingKind, typeof BUILDINGS[BuildingKind]][]).forEach(([kind, spec], index) => {
      const button = document.createElement('button');
      button.className = 'build-item';
      button.title = spec.description;
      button.dataset.kind = kind;
      button.innerHTML = `<b>${spec.icon}</b><span>${spec.label}<small>${index + 4 <= 9 ? index + 4 : ''} · ◈ ${spec.cost}</small></span>`;
      button.addEventListener('click', () => {
        this.setActiveBuild(this.activeBuild === kind ? null : kind);
        actions.onBuild(this.activeBuild);
      });
      buildGrid.appendChild(button);
      this.buildButtons.set(kind, button);
    });

    const recruitGrid = root.querySelector('#recruitGrid')!;
    (Object.entries(SOLDIERS) as [SoldierKind, typeof SOLDIERS[SoldierKind]][]).forEach(([kind, spec]) => {
      const button = document.createElement('button');
      button.className = 'recruit-item';
      button.title = spec.description;
      button.dataset.kind = kind;
      button.draggable = true;
      button.innerHTML = `<b>${spec.icon}</b><span>${spec.label}<small>◈ ${spec.cost}</small></span>`;
      button.addEventListener('click', () => actions.onRecruit(kind));
      button.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', kind);
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
        button.classList.add('dragging');
        actions.onRecruit(kind);
      });
      button.addEventListener('dragend', () => {
        button.classList.remove('dragging');
        window.setTimeout(actions.onRecruitDragEnd, 0);
      });
      recruitGrid.appendChild(button);
      this.recruitButtons.set(kind, button);
    });

    root.querySelectorAll<HTMLElement>('[data-action]').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'pause') actions.onPause();
        if (action === 'speed') actions.onSpeed();
        if (action === 'wave') actions.onWave();
        if (action === 'restart') actions.onRestart();
        if (action === 'home') actions.onHome();
        if (action === 'language') actions.onLanguage();
        if (action === 'guide') this.showGuide();
        if (action === 'guide-close') this.hideGuide();
      });
    });
    root.querySelector('#guidePanel')?.addEventListener('click', (event) => {
      if (event.target === event.currentTarget) this.hideGuide();
    });
    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.root.querySelector('#guidePanel')?.classList.contains('hidden')) {
        this.hideGuide();
      }
    });
    root.querySelectorAll<HTMLElement>('[data-stance]').forEach((button) => {
      button.addEventListener('click', () => actions.onStance(button.dataset.stance as Stance));
    });
    root.querySelectorAll<HTMLElement>('[data-mode]').forEach((button) => {
      button.addEventListener('click', () => actions.onStartMode(button.dataset.mode as GameMode));
    });
  }

  setLanguage(language: Language): void {
    this.language = language;
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    this.root.querySelectorAll<HTMLElement>('[data-zh][data-en]').forEach((element) => {
      element.textContent = language === 'zh' ? element.dataset.zh ?? '' : element.dataset.en ?? '';
    });
    this.root.querySelectorAll<HTMLElement>('[data-action="language"]').forEach((button) => {
      button.textContent = language === 'zh' ? 'EN' : '中';
    });
    this.buildButtons.forEach((button, kind) => {
      const spec = BUILDINGS[kind];
      const label = language === 'zh' ? spec.label : BUILDING_EN[kind][0];
      button.title = language === 'zh' ? spec.description : BUILDING_EN[kind][1];
      const index = (Object.keys(BUILDINGS) as BuildingKind[]).indexOf(kind);
      button.innerHTML = `<b>${spec.icon}</b><span>${label}<small>${index + 4 <= 9 ? index + 4 : ''} · ◈ ${spec.cost}</small></span>`;
    });
    this.recruitButtons.forEach((button, kind) => {
      const spec = SOLDIERS[kind];
      const label = language === 'zh' ? spec.label : SOLDIER_EN[kind][0];
      button.title = language === 'zh' ? spec.description : SOLDIER_EN[kind][1];
      button.innerHTML = `<b>${spec.icon}</b><span>${label}<small>◈ ${spec.cost}</small></span>`;
    });
  }

  update(snapshot: GameSnapshot, nextWave: number, spawning: boolean, remaining: number): void {
    this.lastSnapshot = snapshot;
    const en = this.language === 'en';
    const baseRatio = Math.max(0, Math.min(100, snapshot.baseHp / snapshot.baseMaxHp * 100));
    const baseState = baseRatio <= 25 ? 'critical' : baseRatio <= 55 ? 'warning' : '';
    this.stats.innerHTML = `
      <div><small>${snapshot.mode === 'infinite' ? (en ? 'UNLIMITED COINS' : '无限金币') : (en ? 'SCRAP' : '废料资源')}</small><b class="scrap">◈ ${Number.isFinite(snapshot.scrap) ? snapshot.scrap : '∞'}</b></div>
      <div class="base-stat"><small>${en ? 'BASE HEALTH' : '基地生命值'}</small><b class="${snapshot.baseHp < 350 ? 'danger' : ''}">♥ ${Math.ceil(snapshot.baseHp)} / ${snapshot.baseMaxHp}</b>
        <span class="base-meter"><i class="${baseState}" style="width:${baseRatio}%"></i></span></div>
      <div><small>${en ? 'CURRENT WAVE' : '当前尸潮'}</small><b>${String(snapshot.wave).padStart(2, '0')} <em>${en ? 'BEST' : '最高'} ${snapshot.highWave}</em></b></div>
      <div><small>${en ? 'HOSTILES' : '敌军信号'}</small><b>${snapshot.enemies}</b></div>`;
    this.selection.innerHTML = snapshot.selected
      ? `<b>${en ? `${snapshot.selected} TROOPS SELECTED` : `已选 ${snapshot.selected} 名士兵`}</b><small>${snapshot.selectedRoles} · ${this.stanceName(snapshot.stance)} · ${en ? 'Click ground to move' : '点击空地移动'}</small>`
      : `<b>${en ? 'NO TROOPS SELECTED' : '未选择士兵'}</b><small>${en ? 'Drag to select combat units' : '拖动鼠标框选作战单位'}</small>`;
    this.waveStatus.innerHTML = spawning
      ? `<b>${en ? `WAVE ${snapshot.wave} ENGAGED` : `第 ${snapshot.wave} 波交战中`}</b><span>${en ? `${remaining} signals incoming` : `${remaining} 个信号正在接近`}</span>`
      : `<b>${en ? `NEXT WAVE: ${Math.max(0, Math.ceil(nextWave))}s` : `下一波：${Math.max(0, Math.ceil(nextWave))} 秒`}</b><span>${en ? 'Use the break to build defenses' : '利用间隙修筑防线'}</span>`;
    const pause = this.root.querySelector<HTMLElement>('[data-action="pause"]');
    const speed = this.root.querySelector<HTMLElement>('[data-action="speed"]');
    if (pause) pause.textContent = snapshot.paused ? '▶' : 'Ⅱ';
    if (speed) speed.textContent = `${snapshot.speed}×`;
  }

  setActiveBuild(kind: BuildingKind | null): void {
    this.activeBuild = kind;
    this.buildButtons.forEach((button, buttonKind) => button.classList.toggle('active', kind === buttonKind));
  }

  setActiveRecruit(kind: SoldierKind | null): void {
    this.recruitButtons.forEach((button, buttonKind) => button.classList.toggle('active', kind === buttonKind));
  }

  toast(message: string, danger = false): void {
    const toast = this.root.querySelector<HTMLElement>('#toast')!;
    toast.textContent = message;
    toast.className = `toast show${danger ? ' danger' : ''}`;
    window.setTimeout(() => toast.classList.remove('show'), 1600);
  }

  gameOver(): void {
    const overlay = this.root.querySelector<HTMLElement>('#gameOver')!;
    const score = this.root.querySelector<HTMLElement>('#scoreLine')!;
    score.textContent = this.language === 'zh'
      ? `你坚守到了第 ${this.lastSnapshot?.wave ?? 0} 波`
      : `You survived to wave ${this.lastSnapshot?.wave ?? 0}`;
    overlay.classList.remove('hidden');
  }

  hideGameOver(): void {
    this.root.querySelector('#gameOver')?.classList.add('hidden');
  }

  showHome(highSurvival: number, highInfinite: number): void {
    const survival = this.root.querySelector<HTMLElement>('#highSurvival');
    const infinite = this.root.querySelector<HTMLElement>('#highInfinite');
    if (survival) survival.textContent = String(highSurvival);
    if (infinite) infinite.textContent = String(highInfinite);
    this.root.querySelector('#homeScreen')?.classList.remove('hidden');
  }

  hideHome(): void {
    this.root.querySelector('#homeScreen')?.classList.add('hidden');
    this.hideGuide();
  }

  private showGuide(): void {
    this.root.querySelector('#guidePanel')?.classList.remove('hidden');
  }

  private hideGuide(): void {
    this.root.querySelector('#guidePanel')?.classList.add('hidden');
  }

  private stanceName(stance: Stance | null): string {
    if (stance === 'attack') return this.language === 'en' ? 'ATTACK' : '进攻姿态';
    if (stance === 'retreat') return this.language === 'en' ? 'RETREATING' : '撤退中';
    return this.language === 'en' ? 'DEFEND' : '防御姿态';
  }
}
