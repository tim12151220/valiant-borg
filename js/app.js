/* ==========================================================================
   《一夜終極狼人殺》- 主前端控制器與 UI 交互系統 (js/app.js)
   ========================================================================== */

import { SCENES, GameState } from './state.js';
import { ROLES, TEAMS } from './roles.js';
import { AIEngine } from './ai.js';
import { tts } from './tts.js';
import { P2PManager } from './webrtc.js';

// 初始化全域狀態
const game = new GameState();
let p2p = null;

// 預設角色配置 (4人玩家 + 3底牌 = 7張牌)
const DEFAULT_PLAYERS = [
  { name: 'KuangTing (你)', isAI: false, aiPersonality: 'normal' },
  { name: '愛麗絲 🤖', isAI: true, aiPersonality: 'honest' },
  { name: '波比 🤖', isAI: true, aiPersonality: 'cunning' },
  { name: '查理 🤖', isAI: true, aiPersonality: 'chaotic' }
];

const DEFAULT_ROLES = ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker', 'villager', 'tanner'];

// 3 ~ 10 人黃金配置與設計邏輯數據庫
const GOLDEN_PRESETS = {
  3: {
    roles: ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker', 'villager'],
    desc: '極限心理戰：3人局經典，底牌有3張。可能出現雙狼都在底牌的無狼局，強盜搗蛋鬼精采演技大對決。'
  },
  4: {
    roles: ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker', 'drunk', 'villager'],
    desc: '加入酒鬼：酒鬼不知道自己拿到什麼，這讓狼人非常好假冒酒鬼，增加村民投票的不確定性。'
  },
  5: {
    roles: ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker', 'insomniac', 'tanner', 'villager'],
    desc: '加入皮皮鬼與失眠者：失眠者可自我驗證；皮皮鬼則會讓人不敢輕易投死怪異者，大幅混淆視聽。'
  },
  6: {
    roles: ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker', 'insomniac', 'drunk', 'tanner', 'hunter'],
    desc: '無村民黃金心機局：獵人死亡會帶走他投的人。如果狼人想投死獵人，很可能遭到反殺！'
  },
  7: {
    roles: ['werewolf', 'werewolf', 'minion', 'seer', 'robber', 'troublemaker', 'insomniac', 'drunk', 'tanner', 'villager'],
    desc: '加入爪牙：爪牙認識狼人，但狼人不知道爪牙。爪牙目標是瘋狂攪局、悍跳神職幫狼人擋刀。'
  },
  8: {
    roles: ['werewolf', 'werewolf', 'minion', 'seer', 'mason', 'mason', 'robber', 'troublemaker', 'insomniac', 'drunk', 'tanner'],
    desc: '加入守墓人 x2：兩位守墓人夜晚會互認，為村民陣營提供絕對互信的推理真理基石。'
  },
  9: {
    roles: ['werewolf', 'werewolf', 'minion', 'seer', 'mason', 'mason', 'robber', 'troublemaker', 'insomniac', 'drunk', 'tanner', 'hunter', 'villager'],
    desc: '大混亂派對：好人陣線非常龐大，狼人與爪牙必須極有默契地編造完美身份鏈才能生存。'
  },
  10: {
    roles: ['werewolf', 'werewolf', 'minion', 'seer', 'mason', 'mason', 'robber', 'troublemaker', 'insomniac', 'drunk', 'tanner', 'hunter', 'villager', 'villager'],
    desc: '補上第二張村民：考量座位與發言順序，後段發言者容易捕捉前人漏洞以圓謊或抓狼。'
  }
};

// DOM 節點快取
const dom = {
  scenes: {
    lobby: document.getElementById('scene-lobby'),
    dealing: document.getElementById('scene-dealing'),
    night: document.getElementById('scene-night'),
    day: document.getElementById('scene-day'),
    voting: document.getElementById('scene-voting'),
    result: document.getElementById('scene-result')
  },
  btnModeLocal: document.getElementById('btn-mode-local'),
  btnModeAI: document.getElementById('btn-mode-ai'),
  btnModeP2P: document.getElementById('btn-mode-p2p'),
  lobbyPlayerList: document.getElementById('lobby-player-list'),
  lobbyRoleGrid: document.getElementById('lobby-role-grid'),
  inputPlayerName: document.getElementById('input-player-name'),
  btnAddPlayer: document.getElementById('btn-add-player'),
  btnStartGame: document.getElementById('btn-start-game'),
  setupPlayerCount: document.getElementById('setup-player-count'),
  setupCardNeeded: document.getElementById('setup-card-needed'),
  setupCardSelected: document.getElementById('setup-card-selected'),
  btnApplyPreset: document.getElementById('btn-apply-preset'),
  presetCount: document.getElementById('preset-count'),
  presetLogicDesc: document.getElementById('preset-logic-desc'),
  
  // Dealing DOMs
  dealPromptText: document.getElementById('deal-prompt-text'),
  dealCardContainer: document.getElementById('deal-card-container'),
  dealCardImg: document.getElementById('deal-card-img'),
  dealCardName: document.getElementById('deal-card-name'),
  btnDealAction: document.getElementById('btn-deal-action'),
  dealingTitle: document.getElementById('dealing-title'),

  // Night DOMs
  nightOverlayScreen: document.getElementById('night-overlay-screen'),
  nightNarratorText: document.getElementById('night-narrator-text'),
  nightActionBoard: document.getElementById('night-action-board'),
  nightRoleTitle: document.getElementById('night-role-title'),
  nightInstructionText: document.getElementById('night-instruction-text'),
  nightTablePlayers: document.getElementById('night-table-players'),
  nightTableCenter: document.getElementById('night-table-center'),
  btnNightConfirm: document.getElementById('btn-night-confirm'),
  btnSkipSleep: document.getElementById('btn-skip-sleep'),

  // Day DOMs
  dayTimer: document.getElementById('day-timer'),
  dayPlayersGrid: document.getElementById('day-players-grid'),
  dayCenterGrid: document.getElementById('day-center-grid'),
  discussionChatLog: document.getElementById('discussion-chat-log'),
  inputDaySpeech: document.getElementById('input-day-speech'),
  btnSendSpeech: document.getElementById('btn-send-speech'),
  btnForceVote: document.getElementById('btn-force-vote'),

  // Voting DOMs
  votingBoardGrid: document.getElementById('voting-board-grid'),
  btnSubmitVote: document.getElementById('btn-submit-vote'),

  // Result DOMs
  resultWinnerTitle: document.getElementById('result-winner-title'),
  resultSummaryText: document.getElementById('result-summary-text'),
  deathNamesList: document.getElementById('death-names-list'),
  traceTimelineContainer: document.getElementById('trace-timeline-container'),
  btnRestartGame: document.getElementById('btn-restart-game'),

  // Controls & Debug DOMs
  btnTtsToggle: document.getElementById('btn-tts-toggle'),
  btnDebugToggle: document.getElementById('btn-debug-toggle'),
  developerConsole: document.getElementById('developer-console'),
  btnCloseDebug: document.getElementById('btn-close-debug'),
  devCardFlux: document.getElementById('dev-card-flux'),
  p2pPanel: document.getElementById('p2p-panel'),
  playerAddControls: document.getElementById('player-add-controls')
};

// 全域變數
let dealingIndex = 0; // 當前發牌查看玩家的 index
let currentSelectedCards = []; // 夜晚行動中玩家選定的卡片
let clientVoteSelected = null; // 當前玩家投票的對象 ID
let cheatMode = false; // 是否透視

/* ==========================================================================
   A. 介面跳轉控制
   ========================================================================== */

function showScene(sceneId) {
  Object.values(dom.scenes).forEach(el => el.classList.remove('active'));
  document.getElementById(sceneId).classList.add('active');
  game.currentScene = sceneId;
  updateDebugConsole();
}

window.debugJump = function(stage) {
  if (stage === 'lobby') showScene(SCENES.LOBBY);
  else if (stage === 'dealing') startDealingScene();
  else if (stage === 'night') startNightScene();
  else if (stage === 'day') startDayScene();
  else if (stage === 'voting') startVotingScene();
  else if (stage === 'result') showResultScene();
};

/* ==========================================================================
   B. Lobby 準備階段邏輯與事件
   ========================================================================== */

function initLobby() {
  // 1. 初始化預設玩家
  game.players = [];
  DEFAULT_PLAYERS.forEach(p => game.addPlayer(p.name, p.isAI, p.aiPersonality));
  
  // 2. 初始化預設選用角色
  game.rolesPool = [...DEFAULT_ROLES];

  renderLobbyPlayers();
  renderLobbyRoles();
  updateSetupCounts();

  // 模式按鈕事件
  dom.btnModeLocal.onclick = () => switchMode('local');
  dom.btnModeAI.onclick = () => switchMode('ai');
  dom.btnModeP2P.onclick = () => switchMode('p2p');

  // 新增玩家事件
  dom.btnAddPlayer.onclick = () => {
    const name = dom.inputPlayerName.value.trim();
    if (!name) return;
    if (game.players.length >= 10) {
      alert("本遊戲最多僅支援 10 人。");
      return;
    }
    const isAI = game.mode === 'ai'; // 在 AI 模式下新增的均為 AI
    const personalities = ['honest', 'cunning', 'chaotic', 'quiet'];
    const randPersonality = personalities[Math.floor(Math.random() * personalities.length)];
    game.addPlayer(name + (isAI ? ' 🤖' : ''), isAI, randPersonality);
    dom.inputPlayerName.value = "";
    
    // 自動加 1 張牌以配對 (玩家 + 3)
    if (game.rolesPool.length < game.players.length + 3) {
      game.rolesPool.push('villager');
    }
    
    renderLobbyPlayers();
    updateSetupCounts();
    renderLobbyRoles();
  };

  dom.btnStartGame.onclick = () => {
    if (dom.btnStartGame.classList.contains('disabled')) return;
    // 開始發牌
    game.dealCards();
    startDealingScene();
  };

  // 一鍵套用黃金推薦配置事件
  dom.btnApplyPreset.onclick = () => {
    if (dom.btnApplyPreset.classList.contains('disabled')) return;
    const pCount = game.players.length;
    const preset = GOLDEN_PRESETS[pCount];
    if (preset) {
      game.rolesPool = [...preset.roles];
      renderLobbyRoles();
      updateSetupCounts();
      tts.speak(`已套用 ${pCount} 人黃金配置`);
    } else {
      alert(`目前人數為 ${pCount} 人，推薦配置僅支援 3 到 10 人。`);
    }
  };
}

function switchMode(mode) {
  game.mode = mode;
  [dom.btnModeLocal, dom.btnModeAI, dom.btnModeP2P].forEach(btn => btn.classList.remove('active'));
  
  if (mode === 'local') {
    dom.btnModeLocal.classList.add('active');
    dom.p2pPanel.classList.add('hidden');
    dom.playerAddControls.classList.remove('hidden');
  } else if (mode === 'ai') {
    dom.btnModeAI.classList.add('active');
    dom.p2pPanel.classList.add('hidden');
    dom.playerAddControls.classList.remove('hidden');
    // 自動把其他人都換成 AI
    game.players.forEach((p, idx) => {
      if (idx > 0) {
        p.isAI = true;
        if (!p.name.includes('🤖')) p.name += ' 🤖';
      }
    });
  } else if (mode === 'p2p') {
    dom.btnModeP2P.classList.add('active');
    dom.p2pPanel.classList.remove('hidden');
    dom.playerAddControls.classList.add('hidden');
    initP2P();
  }
  
  renderLobbyPlayers();
  updateSetupCounts();
}

function renderLobbyPlayers() {
  dom.lobbyPlayerList.innerHTML = "";
  game.players.forEach(p => {
    const li = document.createElement('li');
    let tags = "";
    if (p.isAI) tags += `<span class="player-tag-ai">AI: ${p.aiPersonality}</span>`;
    else if (p.id === game.players[0].id) tags += `<span class="player-tag-you">你</span>`;

    li.innerHTML = `
      <span>👤 ${p.name} ${tags}</span>
      ${game.players.length > 3 ? `<button class="btn-delete" data-id="${p.id}">✖</button>` : ''}
    `;

    const delBtn = li.querySelector('.btn-delete');
    if (delBtn) {
      delBtn.onclick = () => {
        game.removePlayer(p.id);
        if (game.rolesPool.length > game.players.length + 3) {
          game.rolesPool.pop();
        }
        renderLobbyPlayers();
        updateSetupCounts();
        renderLobbyRoles();
      };
    }

    dom.lobbyPlayerList.appendChild(li);
  });
}

function renderLobbyRoles() {
  dom.lobbyRoleGrid.innerHTML = "";
  Object.keys(ROLES).forEach(key => {
    const role = ROLES[key];
    const countInPool = game.rolesPool.filter(r => r === role.id).length;
    
    const card = document.createElement('div');
    card.className = `role-select-card ${countInPool > 0 ? 'active' : ''}`;
    card.innerHTML = `
      <span style="font-size: 1.5rem;">${role.icon}</span>
      <h4>${role.name}</h4>
      <span>${role.team === TEAMS.WEREWOLF ? '狼人陣營' : role.team === TEAMS.TANNER ? '皮皮鬼' : '村民陣營'}</span>
      ${countInPool > 0 ? `<div class="role-count-badge">x${countInPool}</div>` : ''}
    `;

    card.onclick = () => {
      // 點擊新增或移除角色
      const totalNeeded = game.players.length + 3;
      if (countInPool > 0) {
        // 移除一個
        const idx = game.rolesPool.indexOf(role.id);
        game.rolesPool.splice(idx, 1);
      } else {
        // 新增一個
        if (game.rolesPool.length >= totalNeeded) {
          // 若已滿，隨機頂替一個白板村民
          const villagerIdx = game.rolesPool.indexOf('villager');
          if (villagerIdx !== -1) {
            game.rolesPool.splice(villagerIdx, 1);
          } else {
            // 沒有村民，直接移除最後一個
            game.rolesPool.pop();
          }
        }
        game.rolesPool.push(role.id);
      }
      renderLobbyRoles();
      updateSetupCounts();
    };

    dom.lobbyRoleGrid.appendChild(card);
  });
}

function updateSetupCounts() {
  const pCount = game.players.length;
  const needed = pCount + 3;
  const selected = game.rolesPool.length;
  
  dom.setupPlayerCount.innerText = pCount;
  dom.setupCardNeeded.innerText = needed;
  dom.setupCardSelected.innerText = selected;

  // 動態更新人數黃金配置資訊
  dom.presetCount.innerText = pCount;
  const preset = GOLDEN_PRESETS[pCount];
  if (preset) {
    dom.presetLogicDesc.innerText = `💡 ${preset.desc}`;
    dom.btnApplyPreset.classList.remove('disabled');
  } else {
    dom.presetLogicDesc.innerText = `⚠️ 目前人數無推薦黃金配置 (支援 3 到 10 人局)`;
    dom.btnApplyPreset.classList.add('disabled');
  }

  if (needed === selected) {
    dom.btnStartGame.classList.remove('disabled');
    dom.btnStartGame.innerText = "確認並發牌";
  } else {
    dom.btnStartGame.classList.add('disabled');
    dom.btnStartGame.innerText = `需選 ${needed} 張牌 (已選 ${selected})`;
  }
}

/* ==========================================================================
   C. WebRTC P2P 連線模組串接
   ========================================================================== */

function initP2P() {
  if (p2p) return;
  p2p = new P2PManager((msg, conn) => {
    // 收到 P2P 訊息處理
    if (msg.type === 'JOIN_LOBBY') {
      // 遠端加入
      if (game.players.length < 10) {
        game.addPlayer(msg.playerName, false);
        renderLobbyPlayers();
        updateSetupCounts();
        renderLobbyRoles();
        p2p.send({ type: 'LOBBY_STATE', players: game.players, rolesPool: game.rolesPool });
      }
    } else if (msg.type === 'LOBBY_STATE') {
      // 同步 Host 狀態
      game.players = msg.players;
      game.rolesPool = msg.rolesPool;
      renderLobbyPlayers();
      updateSetupCounts();
      renderLobbyRoles();
    }
  }, (status, data) => {
    if (status === 'created') {
      document.getElementById('p2p-room-info').classList.remove('hidden');
      document.getElementById('text-room-id').innerText = data;
    }
  });

  document.getElementById('btn-p2p-create').onclick = () => p2p.createRoom();
  document.getElementById('btn-p2p-join').onclick = () => {
    const rId = document.getElementById('input-room-id').value.trim();
    if (rId) p2p.joinRoom(rId);
  };
  document.getElementById('btn-copy-room-id').onclick = () => {
    navigator.clipboard.writeText(p2p.roomId);
    alert("房間 ID 已複製到剪貼簿！");
  };
}

/* ==========================================================================
   D. Dealing 發牌與初始查看階段 UI 綁定
   ========================================================================== */

function startDealingScene() {
  showScene(SCENES.DEALING);
  dealingIndex = 0;
  dom.dealCardContainer.classList.remove('flipped');
  triggerNextPlayerDealPeek();
}

function triggerNextPlayerDealPeek() {
  dom.dealCardContainer.classList.remove('flipped');
  const innerTarotCard = dom.dealCardContainer.querySelector('.tarot-card');
  if (innerTarotCard) innerTarotCard.classList.remove('flipped');

  // 如果所有人都有看過卡牌了，進入夜晚階段！
  if (dealingIndex >= game.players.length) {
    startNightScene();
    return;
  }

  const currentPlayer = game.players[dealingIndex];
  
  if (game.mode === 'ai' && currentPlayer.isAI) {
    // AI 模式中，AI 玩家不需人工點選查看身分，自動跳過
    dealingIndex++;
    triggerNextPlayerDealPeek();
    return;
  }

  dom.dealingTitle.innerText = `發牌階段 (${dealingIndex + 1}/${game.players.length})`;

  // 1. Pass & Play 下，提示該玩家上前
  if (game.mode === 'local') {
    dom.dealPromptText.innerHTML = `請 <strong>${currentPlayer.name}</strong> 上前。<br>點選下方按鈕查看你的初始身份（防窺保護中）。`;
    dom.btnDealAction.innerText = "查看我的身份";
    dom.btnDealAction.onclick = () => {
      // 3D 翻牌顯示身份
      revealDealCard(currentPlayer);
    };
  } else {
    // 玩家自己查看身份
    dom.dealPromptText.innerHTML = `你好，<strong>${currentPlayer.name}</strong>！<br>點選按鈕以查看你在本局的初始身份角色。`;
    dom.btnDealAction.innerText = "查看我的身份";
    dom.btnDealAction.onclick = () => {
      revealDealCard(currentPlayer);
    };
  }
}

function revealDealCard(player) {
  const role = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === player.initialRole)];
  const cardFront = dom.dealCardContainer.querySelector('.card-front');
  
  // 根據是否有獨特卡牌插圖進行發牌正面渲染
  if (role.img && role.img !== 'assets/card_back.png') {
    cardFront.innerHTML = `
      <div class="role-frame">
        <img src="${role.img}" alt="${role.name}" style="width:100%;height:100%;object-fit:cover;">
        <div class="role-name-overlay">${role.name}</div>
      </div>
    `;
  } else {
    // 渲染大比例高規格 CSS 霓虹符文背面
    cardFront.innerHTML = `
      <div class="card-rune-illustration" style="border: 4px solid ${role.bgGlow}; box-shadow: inset 0 0 25px ${role.bgGlow}; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2rem;">
        <div class="rune-symbol" style="font-size: 5.5rem; filter: drop-shadow(0 0 15px ${role.bgGlow});">${role.icon}</div>
        <div style="font-family: var(--font-card); font-size: 2rem; font-weight: 900; color: white; text-shadow: 0 0 10px ${role.bgGlow};">${role.name}</div>
      </div>
    `;
  }
  
  cardFront.style.borderColor = role.bgGlow;
  cardFront.style.boxShadow = `0 0 25px ${role.bgGlow}`;

  // 翻轉卡片
  dom.dealCardContainer.classList.add('flipped');
  const innerTarotCard = dom.dealCardContainer.querySelector('.tarot-card');
  if (innerTarotCard) innerTarotCard.classList.add('flipped');

  // TTS 語音旁白：告知玩家角色
  tts.speak(`你是${role.name}`);

  // 修改按鈕為下一個
  dom.btnDealAction.innerText = "我記住了，閉眼 (下一位)";
  dom.btnDealAction.onclick = () => {
    dealingIndex++;
    triggerNextPlayerDealPeek();
  };
}

/* ==========================================================================
   E. Night 夜晚閉眼行動與自動化
   ========================================================================== */

function startNightScene() {
  showScene(SCENES.NIGHT);
  
  // 所有人閉眼
  dom.nightOverlayScreen.classList.add('active');
  dom.nightActionBoard.classList.add('hidden');
  dom.btnSkipSleep.classList.add('hidden');

  // 啟動夜晚狀態機
  tts.speak("天黑請閉眼...", () => {
    game.nextNightPhase(
      () => {}, // 狀態轉移
      (role, activePlayer, isSimulated) => {
        // 當前夜晚角色睜眼
        renderNightBoard(role, activePlayer, isSimulated);
      },
      () => {
        // 夜晚全部完成，天亮了
        startDayScene();
      }
    );
  });
}

function renderNightBoard(role, activePlayer, isSimulated) {
  // 如果是模擬不在場的角色，前台大遮罩維持不動
  if (isSimulated || !activePlayer) {
    dom.nightNarratorText.innerText = `${role.name}正在行動中...`;
    dom.nightOverlayScreen.classList.add('active');
    dom.nightActionBoard.classList.add('hidden');
    return;
  }

  // 若是真人玩家，顯示行動面板
  dom.nightOverlayScreen.classList.remove('active');
  dom.nightActionBoard.classList.remove('hidden');

  dom.nightRoleTitle.innerText = `🌙 ${role.name} 行動時間 (${activePlayer.name})`;
  dom.nightInstructionText.innerText = role.description;

  // 顯眼的大字身份霓虹 Banner，讓玩家一睜眼就知道自己是誰！
  const banner = document.getElementById('night-identity-banner');
  if (banner) {
    const initRoleConfig = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === activePlayer.initialRole)];
    banner.innerHTML = `<span style="color:${initRoleConfig.bgGlow}; text-shadow:0 0 10px ${initRoleConfig.bgGlow}; font-weight:900;">${initRoleConfig.icon} 你的身份是：${initRoleConfig.name}</span>`;
    banner.style.borderColor = initRoleConfig.bgGlow;
    banner.style.boxShadow = `0 0 15px ${initRoleConfig.bgGlow}`;
  }

  // 初始化選擇器變數
  currentSelectedCards = [];
  dom.btnNightConfirm.classList.add('disabled');

  // 1. 繪製桌面玩家卡片
  dom.nightTablePlayers.innerHTML = "";
  game.players.forEach(p => {
    const isSelf = p.id === activePlayer.id;
    const cardSlot = document.createElement('div');
    cardSlot.className = "table-card-slot";
    
    // 如果是透視模式，則夜晚卡牌皆翻開
    const isFlipped = cheatMode || (role.id === 'insomniac' && isSelf) || (role.id === 'werewolf' && p.initialRole === 'werewolf');
    
    cardSlot.innerHTML = `
      <div class="table-card-wrapper ${isFlipped ? 'flipped-mini' : ''}" data-id="${p.id}">
        <div class="card-face-mini card-mini-back">
          <img src="assets/card_back.png" alt="卡背">
        </div>
        <div class="card-face-mini card-mini-front">
          ${getMiniCardFrontHTML(p.currentCard)}
        </div>
      </div>
      <div class="card-slot-name">${p.name} ${isSelf ? '(你)' : ''}</div>
    `;

    const cardWrapper = cardSlot.querySelector('.table-card-wrapper');
    cardWrapper.onclick = () => {
      handleNightCardClick(role, p, cardWrapper);
    };

    dom.nightTablePlayers.appendChild(cardSlot);
  });

  // 2. 繪製桌面底牌
  dom.nightTableCenter.innerHTML = "";
  game.centerCards.forEach((roleId, idx) => {
    const isFlipped = cheatMode;
    const cardSlot = document.createElement('div');
    cardSlot.className = "table-card-slot";
    cardSlot.innerHTML = `
      <div class="table-card-wrapper ${isFlipped ? 'flipped-mini' : ''}" data-index="${idx}">
        <div class="card-face-mini card-mini-back">
          <img src="assets/card_back.png" alt="卡背">
        </div>
        <div class="card-face-mini card-mini-front">
          ${getMiniCardFrontHTML(roleId)}
        </div>
      </div>
      <div class="card-slot-badge">底牌 ${idx + 1}</div>
    `;

    const cardWrapper = cardSlot.querySelector('.table-card-wrapper');
    cardWrapper.onclick = () => {
      handleNightCenterCardClick(role, idx, cardWrapper);
    };

    dom.nightTableCenter.appendChild(cardSlot);
  });
}

function getMiniCardFrontHTML(roleId) {
  const r = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === roleId)];
  // 統一採用極致 premium 的純 CSS 霓虹符文正面，防範本地無圖片或 CORS 破圖
  return `
    <div class="card-rune-illustration" style="border: 2px solid ${r.bgGlow}; box-shadow: inset 0 0 10px ${r.bgGlow}; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 0.75rem;">
      <div class="rune-symbol" style="font-size: 2.25rem; filter: drop-shadow(0 0 8px ${r.bgGlow});">${r.icon}</div>
      <div style="font-family: var(--font-card); font-size: 0.95rem; font-weight: bold; color: white; text-shadow: 0 0 5px ${r.bgGlow};">${r.name}</div>
    </div>
  `;
}

// 處理點選其他玩家卡片
function handleNightCardClick(activeRole, clickedPlayer, cardWrapper) {
  const roleId = activeRole.id;

  if (roleId === 'seer') {
    // 預言家：看一個人的牌
    if (clickedPlayer.id === game.players.find(p => p.initialRole === 'seer').id) return; // 不能看自己
    
    // 如果已經點了底牌，預言家就不能看玩家了
    if (currentSelectedCards.some(c => c.type === 'center')) return;

    currentSelectedCards = [{ type: 'player', id: clickedPlayer.id, element: cardWrapper }];
    
    // 移除其他人的 selected
    dom.nightActionBoard.querySelectorAll('.table-card-wrapper').forEach(el => el.classList.remove('selected'));
    cardWrapper.classList.add('selected');
    dom.btnNightConfirm.classList.remove('disabled');

    // 點擊確認即可觀看並翻轉
    dom.btnNightConfirm.onclick = () => {
      cardWrapper.classList.add('flipped-mini');
      game.logTimeline('seer', '預言家', clickedPlayer.currentCard, `查看了玩家 ${clickedPlayer.name} 的卡牌`);
      tts.speak(`他是一張${ROLES[Object.keys(ROLES).find(k => ROLES[k].id === clickedPlayer.currentCard)].name}`);
      dom.btnNightConfirm.classList.add('disabled');
    };
  } 
  
  else if (roleId === 'robber') {
    // 強盜：偷一個人的牌並看
    if (clickedPlayer.initialRole === 'robber') return; // 不能偷自己

    currentSelectedCards = [{ type: 'player', id: clickedPlayer.id, element: cardWrapper }];
    dom.nightActionBoard.querySelectorAll('.table-card-wrapper').forEach(el => el.classList.remove('selected'));
    cardWrapper.classList.add('selected');
    dom.btnNightConfirm.classList.remove('disabled');

    dom.btnNightConfirm.onclick = () => {
      // 交換卡片邏輯
      const robberPlayer = game.players.find(p => p.initialRole === 'robber');
      const temp = robberPlayer.currentCard;
      robberPlayer.currentCard = clickedPlayer.currentCard;
      clickedPlayer.currentCard = temp;

      cardWrapper.classList.add('flipped-mini');
      game.logTimeline(robberPlayer.id, robberPlayer.name, robberPlayer.currentCard, `搶奪了玩家 ${clickedPlayer.name} 的牌`);
      
      const newRole = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === robberPlayer.currentCard)].name;
      tts.speak(`你搶到了${newRole}`);
      dom.btnNightConfirm.classList.add('disabled');
    };
  } 
  
  else if (roleId === 'troublemaker') {
    // 搗蛋鬼：選兩個其他玩家交換 (不能看牌)
    if (clickedPlayer.initialRole === 'troublemaker') return; // 不能選自己

    // 如果已經在名單中，再次點擊取消
    const index = currentSelectedCards.findIndex(c => c.id === clickedPlayer.id);
    if (index !== -1) {
      currentSelectedCards.splice(index, 1);
      cardWrapper.classList.remove('selected');
    } else {
      if (currentSelectedCards.length < 2) {
        currentSelectedCards.push({ type: 'player', id: clickedPlayer.id, element: cardWrapper });
        cardWrapper.classList.add('selected');
      }
    }

    if (currentSelectedCards.length === 2) {
      dom.btnNightConfirm.classList.remove('disabled');
      dom.btnNightConfirm.onclick = () => {
        // 強制交換其他兩玩家的 currentCard
        const p1 = game.players.find(p => p.id === currentSelectedCards[0].id);
        const p2 = game.players.find(p => p.id === currentSelectedCards[1].id);
        const temp = p1.currentCard;
        p1.currentCard = p2.currentCard;
        p2.currentCard = temp;

        game.logTimeline('troublemaker', '搗蛋鬼', 'troublemaker', `交換了 ${p1.name} 和 ${p2.name} 的卡牌`);
        tts.speak("交換成功");
        
        // 閃爍兩張卡片以資慶賀
        currentSelectedCards[0].element.classList.remove('selected');
        currentSelectedCards[1].element.classList.remove('selected');
        dom.btnNightConfirm.classList.add('disabled');
      };
    } else {
      dom.btnNightConfirm.classList.add('disabled');
    }
  }
}

// 處理點選底牌
function handleNightCenterCardClick(activeRole, clickedIdx, cardWrapper) {
  const roleId = activeRole.id;

  if (roleId === 'seer') {
    // 預言家：看兩張底牌
    if (currentSelectedCards.some(c => c.type === 'player')) return; // 若已看玩家，不能看底牌
    
    const index = currentSelectedCards.findIndex(c => c.idx === clickedIdx);
    if (index !== -1) {
      currentSelectedCards.splice(index, 1);
      cardWrapper.classList.remove('selected');
    } else {
      if (currentSelectedCards.length < 2) {
        currentSelectedCards.push({ type: 'center', idx: clickedIdx, element: cardWrapper });
        cardWrapper.classList.add('selected');
      }
    }

    if (currentSelectedCards.length === 2) {
      dom.btnNightConfirm.classList.remove('disabled');
      dom.btnNightConfirm.onclick = () => {
        // 翻開兩張底牌
        currentSelectedCards.forEach(c => {
          c.element.classList.add('flipped-mini');
          const cardRole = game.centerCards[c.idx];
          game.logTimeline('seer', '預言家', cardRole, `查看了桌面底牌 ${c.idx + 1}`);
        });
        
        const r1 = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === game.centerCards[currentSelectedCards[0].idx])].name;
        const r2 = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === game.centerCards[currentSelectedCards[1].idx])].name;
        tts.speak(`底牌分別是${r1}和${r2}`);
        dom.btnNightConfirm.classList.add('disabled');
      };
    } else {
      dom.btnNightConfirm.classList.add('disabled');
    }
  } 
  
  else if (roleId === 'drunk') {
    // 酒鬼：強制換一張底牌 (不能看)
    currentSelectedCards = [{ type: 'center', idx: clickedIdx, element: cardWrapper }];
    dom.nightActionBoard.querySelectorAll('.table-card-wrapper').forEach(el => el.classList.remove('selected'));
    cardWrapper.classList.add('selected');
    dom.btnNightConfirm.classList.remove('disabled');

    dom.btnNightConfirm.onclick = () => {
      const drunkPlayer = game.players.find(p => p.initialRole === 'drunk');
      const temp = drunkPlayer.currentCard;
      drunkPlayer.currentCard = game.centerCards[clickedIdx];
      game.centerCards[clickedIdx] = temp;

      game.logTimeline(drunkPlayer.id, drunkPlayer.name, drunkPlayer.currentCard, `將卡牌與底牌 ${clickedIdx + 1} 進行了交換`);
      tts.speak("交換成功");
      cardWrapper.classList.remove('selected');
      dom.btnNightConfirm.classList.add('disabled');
    };
  }
}

/* ==========================================================================
   F. Day 白天討論與 AI 推理牆發言
   ========================================================================== */

function startDayScene() {
  showScene(SCENES.DAY);
  
  // 恢復白天倒計時
  game.dayTimeLeft = 180;
  dom.dayTimer.innerText = "03:00";
  
  if (game.dayTimerId) clearInterval(game.dayTimerId);
  game.dayTimerId = setInterval(() => {
    game.dayTimeLeft--;
    const min = String(Math.floor(game.dayTimeLeft / 60)).padStart(2, '0');
    const sec = String(game.dayTimeLeft % 60).padStart(2, '0');
    dom.dayTimer.innerText = `${min}:${sec}`;

    if (game.dayTimeLeft <= 0) {
      clearInterval(game.dayTimerId);
      startVotingScene();
    }
  }, 1000);

  tts.speak("天亮了，大家請睜眼討論！");

  // 1. 渲染白天存活玩家（僅自己顯示角色，其他人皆顯示卡背，除非透視）
  renderDayPlayers();

  // 2. 清空發言牆
  dom.discussionChatLog.innerHTML = `<div class="chat-msg system">☀️ 天亮了，討論開始！系統已模擬出 AI 玩家的最新心思，注意每個人所說的話...</div>`;

  // 3. AI 玩家依序噴發推理發言 (AI Sandbox 關鍵！)
  if (game.mode === 'ai') {
    triggerAISpeeches();
  }

  // 發言輸入
  dom.btnSendSpeech.onclick = () => {
    const val = dom.inputDaySpeech.value.trim();
    if (!val) return;
    addChatMessage(game.players[0].name, val, 'user-speech');
    dom.inputDaySpeech.value = "";
  };

  dom.btnForceVote.onclick = () => {
    if (game.dayTimerId) clearInterval(game.dayTimerId);
    startVotingScene();
  };
}

function renderDayPlayers() {
  dom.dayPlayersGrid.innerHTML = "";
  
  const userSelf = game.players[0];

  // 1. 計算衝突宣稱 (衝突定義：非村民唯一牌，被 >= 2 人宣稱)
  const claimCounts = {};
  game.players.forEach(p => {
    if (p.publicClaim && p.publicClaim !== 'villager') {
      claimCounts[p.publicClaim] = (claimCounts[p.publicClaim] || 0) + 1;
    }
  });

  // 2. 尋找強盜與搗蛋鬼技能對應目標
  let robbedPlayerName = "";
  if (userSelf.initialRole === 'robber') {
    const trace = game.timelineTrace.find(t => t.targetId === userSelf.id && t.action.includes('搶奪了玩家'));
    if (trace) {
      const match = trace.action.match(/玩家\s*(.+?)\s*的/);
      if (match) robbedPlayerName = match[1].trim();
    }
  }

  let swappedPlayerNames = [];
  if (userSelf.initialRole === 'troublemaker') {
    const trace = game.timelineTrace.find(t => t.action.includes('交換了') && t.action.includes('卡牌'));
    if (trace) {
      const match = trace.action.match(/交換了\s*(.+?)\s*和\s*(.+?)\s*的/);
      if (match) {
        swappedPlayerNames.push(match[1].trim(), match[2].trim());
      }
    }
  }

  game.players.forEach(p => {
    const isSelf = p.id === userSelf.id;
    const item = document.createElement('div');
    item.className = "player-board-item";
    
    // 如果是自己或者是透視，顯示身份正面，否則顯示卡背
    const showFront = isSelf || cheatMode;

    // 建立「對外宣稱身份徽章」
    let claimBadgeHTML = "";
    if (!p.publicClaim) {
      claimBadgeHTML = `<div class="claim-badge unclaimed" id="claim-${p.id}">❓ 未宣稱身份</div>`;
    } else {
      const roleConfig = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === p.publicClaim)];
      const isConflict = claimCounts[p.publicClaim] > 1;
      claimBadgeHTML = `
        <div class="claim-badge ${isConflict ? 'conflict' : ''}" id="claim-${p.id}">
          ${isConflict ? '⚠️ 對跳衝突: ' : ''} ${roleConfig.icon} ${roleConfig.name}
        </div>
      `;
    }

    // 建立「私人推論筆記與強盜/搗蛋鬼標記」
    let privateAreaHTML = "";
    if (!isSelf) {
      const note = userSelf.privateNotes[p.id];
      if (!note) {
        privateAreaHTML += `<div class="hypothesis-badge" id="note-${p.id}">🕵️ 標記推測</div>`;
      } else {
        const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === note)];
        privateAreaHTML += `<div class="hypothesis-badge marked" id="note-${p.id}">🕵️ 推測: ${rConf.icon} ${rConf.name}</div>`;
      }

      // 強盜專屬提示 (僅自己是強盜可見)
      if (p.name.trim() === robbedPlayerName) {
        privateAreaHTML += `<div class="special-action-badge robbed">🛡️ 被你偷了</div>`;
      }

      // 搗蛋鬼專屬提示 (僅自己是搗蛋鬼可見)
      if (swappedPlayerNames.includes(p.name.trim())) {
        privateAreaHTML += `<div class="special-action-badge swapped">⚡ 被你對調</div>`;
      }
    } else {
      privateAreaHTML += `<div style="font-size:0.65rem; color:var(--glow-cyan); font-family:var(--font-tech);">⭐ 點卡牌可改宣稱</div>`;
    }

    item.innerHTML = `
      ${claimBadgeHTML}
      <div class="player-avatar" style="margin-top: 5px;">👤</div>
      <h4 style="font-weight: 800; font-size: 0.95rem; margin-top:2px;">${p.name}</h4>
      <div class="table-card-wrapper ${showFront ? 'flipped-mini' : ''}" style="width: 80px; height: 112px; cursor: ${isSelf ? 'pointer' : 'default'};">
        <div class="card-face-mini card-mini-back">
          <img src="assets/card_back.png" alt="卡背">
        </div>
        <div class="card-face-mini card-mini-front">
          ${getMiniCardFrontHTML(p.currentCard)}
        </div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; gap:2px; margin-top: 5px; width:100%;">
        ${privateAreaHTML}
      </div>
    `;

    // 點選自己的卡片或宣稱徽章可以修改對外宣稱身份
    if (isSelf) {
      const triggerSelect = () => openPublicClaimSelector(p);
      item.querySelector('.table-card-wrapper').onclick = (e) => {
        e.stopPropagation();
        triggerSelect();
      };
      item.querySelector(`#claim-${p.id}`).onclick = (e) => {
        e.stopPropagation();
        triggerSelect();
      };
    } else {
      // 點選其他人的筆記徽章或卡片可以進行推理筆記
      const noteBadge = item.querySelector(`#note-${p.id}`);
      if (noteBadge) {
        noteBadge.onclick = (e) => {
          e.stopPropagation();
          openPrivateNoteSelector(p);
        };
      }
    }

    dom.dayPlayersGrid.appendChild(item);
  });

  // 桌面底牌
  dom.dayCenterGrid.innerHTML = "";
  game.centerCards.forEach((roleId, idx) => {
    const item = document.createElement('div');
    item.className = "table-card-slot";
    
    // 底牌的私人筆記標記
    const note = userSelf.privateNotes[`center_${idx}`];
    let noteBadgeHTML = "";
    if (!note) {
      noteBadgeHTML = `<div class="hypothesis-badge" id="note-center-${idx}" style="margin-top: 4px;">🕵️ 盲猜底牌</div>`;
    } else {
      const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === note)];
      noteBadgeHTML = `<div class="hypothesis-badge marked" id="note-center-${idx}" style="margin-top: 4px;">🕵️ 推測: ${rConf.icon} ${rConf.name}</div>`;
    }

    item.innerHTML = `
      <div class="table-card-wrapper ${cheatMode ? 'flipped-mini' : ''}" style="width: 80px; height: 112px; pointer-events: none;">
        <div class="card-face-mini card-mini-back">
          <img src="assets/card_back.png" alt="卡背">
        </div>
        <div class="card-face-mini card-mini-front">
          ${getMiniCardFrontHTML(roleId)}
        </div>
      </div>
      <div class="card-slot-badge" style="font-size:0.6rem; margin-top:2px;">底牌 ${idx + 1}</div>
      ${noteBadgeHTML}
    `;

    const centerNoteBadge = item.querySelector(`#note-center-${idx}`);
    if (centerNoteBadge) {
      centerNoteBadge.onclick = (e) => {
        e.stopPropagation();
        openCenterPrivateNoteSelector(idx);
      };
    }

    dom.dayCenterGrid.appendChild(item);
  });
}

function addChatMessage(sender, text, typeClass = 'ai-speech') {
  const msg = document.createElement('div');
  msg.className = `chat-msg ${typeClass}`;
  msg.innerHTML = `
    <div class="chat-sender-name">${sender}</div>
    <div>${text}</div>
  `;
  dom.discussionChatLog.appendChild(msg);
  dom.discussionChatLog.scrollTop = dom.discussionChatLog.scrollHeight;
}

function triggerAISpeeches() {
  const aiPlayers = game.players.filter(p => p.isAI);
  
  aiPlayers.forEach((ai, idx) => {
    // 依序隨機延遲 2-10 秒發言，模擬真實對話感
    setTimeout(() => {
      if (game.currentScene !== SCENES.DAY) return;
      const speech = AIEngine.generateSpeech(ai, game.players, game.rolesPool);
      ai.speech = speech;
      addChatMessage(ai.name, speech, 'ai-speech');
      
      // AI 發言時，如果 TTS 開啟，也可以播放簡短對白 (選配/Terse)
      tts.speak(`${ai.name}說：${speech.substring(0, 20)}`);
    }, (idx + 1) * 3000 + (Math.random() * 2000));
  });
}

/* ==========================================================================
   G. Voting 投票階段
   ========================================================================== */

function startVotingScene() {
  showScene(SCENES.VOTING);
  clientVoteSelected = null;
  dom.btnSubmitVote.classList.add('disabled');

  // 渲染投票卡牌
  dom.votingBoardGrid.innerHTML = "";
  game.players.forEach(p => {
    const isSelf = p.id === game.players[0].id;
    const card = document.createElement('div');
    card.className = "vote-card";
    card.innerHTML = `
      <div class="vote-avatar">👤</div>
      <h4 style="font-weight: 800; font-size: 0.95rem;">${p.name}</h4>
      <div class="vote-badge-count hidden" id="vote-badge-${p.id}">0 票</div>
    `;

    card.onclick = () => {
      if (isSelf) return; // 不能投自己
      clientVoteSelected = p.id;
      dom.votingBoardGrid.querySelectorAll('.vote-card').forEach(el => el.classList.remove('selected'));
      card.classList.add('selected');
      dom.btnSubmitVote.classList.remove('disabled');
    };

    dom.votingBoardGrid.appendChild(card);
  });

  dom.btnSubmitVote.onclick = () => {
    if (!clientVoteSelected) return;
    
    // 真人玩家投票
    game.players[0].voteFor = clientVoteSelected;

    // AI 玩家隨機投票 (AI Sandbox)
    game.players.forEach(p => {
      if (p.isAI) {
        // 隨機選一個其他人投，狼人有機會串票投村民，好人有機會投懷疑的壞人
        const others = game.players.filter(o => o.id !== p.id);
        const target = others[Math.floor(Math.random() * others.length)];
        p.voteFor = target.id;
      }
    });

    // 結算並前往 Result 面板
    showResultScene();
  };
}

/* ==========================================================================
   H. Result 結局與卡牌演變軌跡
   ========================================================================== */

function showResultScene() {
  showScene(SCENES.RESULT);

  // 結算勝負
  const res = game.judgeWinner();

  // 顯示獲勝陣營
  dom.resultWinnerTitle.innerText = `${res.winningTeam}獲勝！`;
  dom.resultSummaryText.innerText = res.summaryText;

  // 顯示死亡名單
  if (res.deadPlayers.length > 0) {
    dom.deathNamesList.innerHTML = res.deadPlayers.map(p => {
      const r = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === p.currentCard)];
      return `<span style="color:var(--glow-rose); font-weight:bold;">${p.name} (${r.icon} ${r.name})</span>`;
    }).join(' ＆ ');
  } else {
    dom.deathNamesList.innerHTML = "無人死亡 (大家皆投自己右邊的人，或每人均為 1 票)";
  }

  // 繪製神級的卡牌演變軌跡時間軸！ (Timeline Trace)
  renderTimelineTrace();

  // 再玩一局按鈕
  dom.btnRestartGame.onclick = () => {
    showScene(SCENES.LOBBY);
  };
}

function renderTimelineTrace() {
  dom.traceTimelineContainer.innerHTML = "";
  
  game.players.forEach(p => {
    const trace = document.createElement('div');
    trace.className = "trace-item";

    const initRoleConfig = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === p.initialRole)];
    const finalRoleConfig = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === p.currentCard)];

    // 建立宣稱徽章對比展示
    let claimHTML = "";
    if (p.publicClaim) {
      const cConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === p.publicClaim)];
      // 若宣稱與最終真實身份不符（心機說謊者），亮起紅灰色以利對比
      const isLiar = p.publicClaim !== p.currentCard;
      claimHTML = `
        <span style="background: ${isLiar ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; 
                     border: 1.5px solid ${isLiar ? 'var(--glow-rose)' : 'var(--glow-green)'}; 
                     color: ${isLiar ? '#fca5a5' : '#a7f3d0'};
                     padding: 0.2rem 0.5rem; border-radius: 20px; font-size: 0.7rem; font-weight: bold; font-family: var(--font-tech); margin-top: 4px; display: inline-block;">
          ${isLiar ? '🤥 宣稱: ' : '😇 宣稱: '} ${cConf.icon} ${cConf.name}
        </span>
      `;
    } else {
      claimHTML = `
        <span style="background: rgba(255,255,255,0.02); border: 1px dashed #475569; color: #475569;
                     padding: 0.2rem 0.5rem; border-radius: 20px; font-size: 0.7rem; font-family: var(--font-tech); margin-top: 4px; display: inline-block;">
          😶 宣稱: 未宣稱
        </span>
      `;
    }

    // 檢查夜晚有沒有對他進行過卡牌交換
    let swapActionsHTML = "";
    const pSwaps = game.timelineTrace.filter(t => t.targetId === p.id && t.action !== '初始分配');

    pSwaps.forEach(sw => {
      const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === sw.role)];
      swapActionsHTML += `
        <span class="trace-arrow">➡️</span>
        <div class="trace-action-text">${sw.action}</div>
        <div class="trace-card-node">${rConf.icon} ${rConf.name}</div>
      `;
    });

    trace.innerHTML = `
      <div class="trace-player-info">
        <span class="trace-player-name">${p.name}</span>
        ${claimHTML}
      </div>
      <div class="trace-path-container">
        <div class="trace-card-node initial">${initRoleConfig.icon} ${initRoleConfig.name} (初始)</div>
        ${swapActionsHTML}
        ${p.initialRole !== p.currentCard || pSwaps.length > 0 ? `
          <span class="trace-arrow">➡️</span>
          <div class="trace-card-node final">${finalRoleConfig.icon} ${finalRoleConfig.name} (最終)</div>
        ` : '<span> (無變動)</span>'}
      </div>
    `;

    dom.traceTimelineContainer.appendChild(trace);
  });
}

/* ==========================================================================
   記號筆與筆記系統轉盤選單選擇器 (Claims & Notes Selector Overlay Logic)
   ========================================================================== */

function createFloatingSelector(title, subtitle, onSelect, activeVal = null) {
  // 建立 Overlay 遮罩
  const overlay = document.createElement('div');
  overlay.className = "floating-selector-overlay";

  // 取得本局的所有登場之 unique 角色
  const uniqueRoles = Array.from(new Set(game.rolesPool)).map(id => {
    return ROLES[Object.keys(ROLES).find(k => ROLES[k].id === id)];
  });

  let optionsHTML = "";
  // 新增一個「清空/清除」選項
  optionsHTML += `
    <button class="selector-opt-btn ${activeVal === null ? 'active' : ''}" data-id="clear" style="border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.05);">
      <span style="font-size: 1.5rem;">❌</span>
      <span style="font-weight:bold; color:#f87171;">清除標記</span>
    </button>
  `;

  uniqueRoles.forEach(r => {
    optionsHTML += `
      <button class="selector-opt-btn ${activeVal === r.id ? 'active' : ''}" data-id="${r.id}">
        <span style="font-size: 1.5rem;">${r.icon}</span>
        <span style="font-weight:bold;">${r.name}</span>
      </button>
    `;
  });

  overlay.innerHTML = `
    <div class="selector-menu-card">
      <h4>${title}</h4>
      <p style="font-size:0.8rem; color:#94a3b8; margin-bottom:1.25rem;">${subtitle}</p>
      <div class="selector-options-grid" style="display:grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; margin-bottom: 1.25rem;">
        ${optionsHTML}
      </div>
      <button class="btn btn-secondary btn-sm" id="btn-selector-cancel" style="width:100%;">關閉</button>
    </div>
  `;

  // 點選選項事件
  overlay.querySelectorAll('.selector-opt-btn').forEach(btn => {
    btn.onclick = () => {
      const selectedId = btn.getAttribute('data-id');
      onSelect(selectedId === 'clear' ? null : selectedId);
      document.body.removeChild(overlay);
    };
  });

  // 點選關閉事件
  overlay.querySelector('#btn-selector-cancel').onclick = () => {
    document.body.removeChild(overlay);
  };

  // 點擊 Overlay 背景關閉
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  };

  document.body.appendChild(overlay);
}

function openPublicClaimSelector(player) {
  createFloatingSelector(
    "📢 宣稱我的身份",
    "向所有人公開宣告你在本局的角色，其他對跳玩家會被系統標註衝突。",
    (roleId) => {
      player.publicClaim = roleId;
      renderDayPlayers();
    },
    player.publicClaim
  );
}

function openPrivateNoteSelector(player) {
  createFloatingSelector(
    `🕵️ 推測 ${player.name} 的身分`,
    "這筆記僅你自己看得到，狼人殺推理關鍵工具。",
    (roleId) => {
      const userSelf = game.players[0];
      if (roleId) {
        userSelf.privateNotes[player.id] = roleId;
      } else {
        delete userSelf.privateNotes[player.id];
      }
      renderDayPlayers();
    },
    game.players[0].privateNotes[player.id]
  );
}

function openCenterPrivateNoteSelector(centerIdx) {
  const userSelf = game.players[0];
  const noteKey = `center_${centerIdx}`;
  createFloatingSelector(
    `🕵️ 推測桌面底牌 ${centerIdx + 1}`,
    "這筆記僅自己可見。盲猜底牌有助於排除場上不在的角色。",
    (roleId) => {
      if (roleId) {
        userSelf.privateNotes[noteKey] = roleId;
      } else {
        delete userSelf.privateNotes[noteKey];
      }
      renderDayPlayers();
    },
    userSelf.privateNotes[noteKey]
  );
}

/* ==========================================================================
   I. 系統控制與 Developer Console 除錯面板
   ========================================================================== */

function initSystemControls() {
  // TTS 語音旁白開關
  dom.btnTtsToggle.onclick = () => {
    const state = tts.toggle();
    dom.btnTtsToggle.classList.toggle('active', state);
    dom.btnTtsToggle.innerText = state ? "🗣️ 旁白: 開" : "🗣️ 旁白: 關";
  };

  // 開發者面板開關
  dom.btnDebugToggle.onclick = () => {
    dom.developerConsole.classList.toggle('hidden');
  };
  dom.btnCloseDebug.onclick = () => {
    dom.developerConsole.classList.add('hidden');
  };

  // 全場翻開身份 (透視)
  document.getElementById('btn-debug-cheat').onclick = () => {
    cheatMode = !cheatMode;
    document.getElementById('btn-debug-cheat').innerText = cheatMode ? "全場蓋上身份" : "全場翻開身份";
    
    // 重新渲染當前畫面以套用透視
    if (game.currentScene === SCENES.DAY) renderDayPlayers();
    else if (game.currentScene === SCENES.NIGHT) {
      const currentRole = game.nightOrder[game.currentNightIndex];
      const activePlayer = game.players.find(p => p.initialRole === currentRole.id);
      renderNightBoard(currentRole, activePlayer, !activePlayer);
    }
  };

  // 隨機填入測試資料
  document.getElementById('btn-debug-random-setup').onclick = () => {
    if (game.currentScene !== SCENES.LOBBY) return;
    game.players = [];
    game.addPlayer('玩家甲', false);
    game.addPlayer('AI愛麗絲 🤖', true, 'honest');
    game.addPlayer('AI波比 🤖', true, 'cunning');
    game.addPlayer('AI查理 🤖', true, 'chaotic');
    game.addPlayer('AI大衛 🤖', true, 'quiet');
    
    game.rolesPool = ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker', 'villager', 'tanner', 'insomniac'];
    
    renderLobbyPlayers();
    updateSetupCounts();
    renderLobbyRoles();
  };
}

function updateDebugConsole() {
  if (game.currentScene === SCENES.LOBBY) {
    dom.devCardFlux.innerText = "遊戲尚未開始，無卡牌流向。";
    return;
  }

  let fluxHTML = "";
  game.players.forEach(p => {
    const initR = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === p.initialRole)].name;
    const currR = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === p.currentCard)].name;
    fluxHTML += `<div><strong>${p.name}</strong>: 初始(${initR}) ➡️ 當前(${currR})</div>`;
  });
  
  game.centerCards.forEach((roleId, idx) => {
    const initR = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === game.centerCardsInitial[idx])].name;
    const currR = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === roleId)].name;
    fluxHTML += `<div><strong>底牌 ${idx+1}</strong>: 初始(${initR}) ➡️ 當前(${currR})</div>`;
  });

  dom.devCardFlux.innerHTML = fluxHTML;
}

// 初始化 Lobby
initLobby();
initSystemControls();
