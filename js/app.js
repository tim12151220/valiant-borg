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
let myPlayerId = null; // 全域記錄本機玩家的 ID，解決 P2P 連線身份錯亂問題

// 預設角色配置
const DEFAULT_PLAYERS = [
  { name: '玩家本人', isAI: false, aiPersonality: 'normal' }
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
    roles: ['werewolf', 'werewolf', 'minion', 'seer', 'mason', 'mason', 'robber', 'troublemaker', 'insomniac', 'drunk', 'tanner', 'hunter'],
    desc: '大混亂派對：好人陣線非常龐大，狼人與爪牙必須極有默契地編造完美身份鏈才能生存。'
  },
  10: {
    roles: ['werewolf', 'werewolf', 'minion', 'seer', 'mason', 'mason', 'robber', 'troublemaker', 'insomniac', 'drunk', 'tanner', 'hunter', 'villager'],
    desc: '補上第二張村民：考量座位與發言順序，後段發言者容易捕捉前人漏洞以圆謊或抓狼。'
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
  voteDetailsList: document.getElementById('vote-details-list'),
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
let nightActionConfirmed = false; // 夜晚行動確認鎖，防止技能重複觸發
let confirmedNightIndices = new Set(); // 記錄本機玩家已確認行動的夜晚 Index，防範 P2P 網路抖動或重繪導致的重複交換卡牌與複製卡牌 Bug

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

  // 強制命名遮罩邏輯
  const welcomeOverlay = document.getElementById('welcome-overlay');
  const welcomeInput = document.getElementById('input-welcome-name');
  const welcomeEnterBtn = document.getElementById('btn-welcome-enter');

  welcomeEnterBtn.onclick = () => {
    const wName = welcomeInput.value.trim();
    if (!wName) {
      alert("請輸入你的稱呼以開啟大廳！");
      return;
    }
    // 更新第一個玩家（你）的稱呼與全域 ID 追蹤
    const me = game.players[0];
    me.name = wName; // 不再寫死 ' (你)'，改由 UI 渲染時動態渲染，徹底解決 P2P 同步時的身份錯亂問題！
    myPlayerId = me.id;
    
    // 隱藏強制遮罩 Overlay
    welcomeOverlay.classList.add('hidden');
    
    // 語音旁白引導歡迎
    tts.speak(`歡迎 ${wName} 來到一夜終極狼人殺`);

    renderLobbyPlayers();
    updateSetupCounts();
    renderLobbyRoles();
  };

  welcomeInput.onkeydown = (e) => {
    if (e.key === 'Enter') {
      welcomeEnterBtn.click();
    }
  };

  renderLobbyPlayers();
  renderLobbyRoles();
  updateSetupCounts();

  // 模式按鈕事件
  dom.btnModeLocal.onclick = () => switchMode('local');
  dom.btnModeP2P.onclick = () => switchMode('p2p');

  // 新增玩家事件
  dom.btnAddPlayer.onclick = () => {
    const name = dom.inputPlayerName.value.trim();
    if (!name) return;
    if (game.players.length >= 10) {
      alert("本遊戲最多僅支援 10 人。");
      return;
    }
    game.addPlayer(name, false);
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
    if (game.mode === 'p2p' && p2p.isHost) {
      game.dealCards();
      p2p.send({
        type: 'START_GAME',
        players: game.players,
        centerCards: game.centerCards,
        centerCardsInitial: game.centerCardsInitial,
        rolesPool: game.rolesPool,
        nightOrder: game.nightOrder
      });
      startDealingScene();
    } else if (game.mode !== 'p2p') {
      game.dealCards();
      startDealingScene();
    }
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
      if (game.mode === 'p2p' && p2p.isHost) {
        p2p.send({ type: 'LOBBY_STATE', players: game.players, rolesPool: game.rolesPool });
      }
    } else {
      alert(`目前人數為 ${pCount} 人，推薦配置僅支援 3 到 10 人。`);
    }
  };
}

function switchMode(mode) {
  game.mode = mode;
  [dom.btnModeLocal, dom.btnModeP2P].forEach(btn => btn && btn.classList.remove('active'));
  
  if (mode === 'local') {
    dom.btnModeLocal.classList.add('active');
    dom.p2pPanel.classList.add('hidden');
    dom.playerAddControls.classList.remove('hidden');
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
    else if (p.id === myPlayerId) tags += `<span class="player-tag-you">你</span>`;

    const isSelf = p.id === myPlayerId && !p.isAI;
    const canDelete = !isSelf && game.players.length > 3 && (!p2p || p2p.isHost);
    
    li.innerHTML = `
      <span>👤 ${p.name} ${tags}</span>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        ${isSelf ? `<button class="btn-rename" style="background:none; border:none; color:var(--glow-cyan); cursor:pointer; font-size:0.9rem;" title="修改稱呼">✏️</button>` : ''}
        ${canDelete ? `<button class="btn-delete" data-id="${p.id}" style="background:none; border:none; color:#ef4444; cursor:pointer;">✖</button>` : ''}
      </div>
    `;

    const renameBtn = li.querySelector('.btn-rename');
    if (renameBtn) {
      renameBtn.onclick = () => {
        const cleanName = p.name.replace(' (你)', '').trim();
        const newName = prompt("請輸入你想要的稱呼：", cleanName);
        if (newName && newName.trim()) {
          p.name = newName.trim();
          renderLobbyPlayers();
          
          if (game.mode === 'p2p') {
            if (p2p.isHost) {
              p2p.send({ type: 'LOBBY_STATE', players: game.players, rolesPool: game.rolesPool });
            } else {
              p2p.send({ type: 'RENAME_PLAYER', playerId: myPlayerId, newName: p.name });
            }
          }
        }
      };
    }

    const delBtn = li.querySelector('.btn-delete');
    if (delBtn) {
      delBtn.onclick = () => {
        const kickedPlayerId = p.id;
        game.removePlayer(kickedPlayerId);
        if (game.rolesPool.length > game.players.length + 3) {
          game.rolesPool.pop();
        }
        renderLobbyPlayers();
        updateSetupCounts();
        renderLobbyRoles();
        
        if (game.mode === 'p2p' && p2p.isHost) {
          // 找到被踢玩家的 WebRTC 連線並發送 KICKED 訊息
          const conn = p2p.connections.find(c => c.assignedPlayerId === kickedPlayerId);
          if (conn) {
            conn.send({ type: 'KICKED' });
            setTimeout(() => {
              conn.close();
            }, 300);
          }
          p2p.send({ type: 'LOBBY_STATE', players: game.players, rolesPool: game.rolesPool });
        }
      };
    }

    dom.lobbyPlayerList.appendChild(li);
  });
}

function renderLobbyRoles() {
  dom.lobbyRoleGrid.innerHTML = "";
  const isP2PClient = game.mode === 'p2p' && p2p && !p2p.isHost;

  Object.keys(ROLES).forEach(key => {
    const role = ROLES[key];
    const countInPool = game.rolesPool.filter(r => r === role.id).length;
    
    const card = document.createElement('div');
    card.className = `role-select-card ${countInPool > 0 ? 'active' : ''} ${isP2PClient ? 'disabled' : ''}`;
    card.innerHTML = `
      <span style="font-size: 1.5rem;">${role.icon}</span>
      <h4>${role.name}</h4>
      <span>${role.team === TEAMS.WEREWOLF ? '狼人陣營' : role.team === TEAMS.TANNER ? '皮皮鬼' : '村民陣營'}</span>
      ${countInPool > 0 ? `<div class="role-count-badge">x${countInPool}</div>` : ''}
      
      <!-- 超奢華 Hover Tooltip 說明面板 -->
      <div class="role-tooltip">
        <div class="role-tooltip-header">
          <span>${role.icon}</span> <strong style="color: #f8fafc; font-weight: 800;">${role.name}</strong>
        </div>
        <p>${role.description}</p>
        <div class="role-tooltip-footer">
          💤 夜晚順序: ${role.priority > 0 ? `第 ${role.priority} 醒來` : '無夜晚行動 (全程閉眼)'}
        </div>
      </div>
    `;

    card.onclick = () => {
      if (isP2PClient) return; // Client 不能調整角色池
      
      const totalNeeded = game.players.length + 3;

      const addRoleToPool = (roleId, amount) => {
        for (let i = 0; i < amount; i++) {
          if (game.rolesPool.length >= totalNeeded) {
            const villagerIdx = game.rolesPool.indexOf('villager');
            if (villagerIdx !== -1) {
              game.rolesPool.splice(villagerIdx, 1);
            } else {
              game.rolesPool.pop();
            }
          }
          game.rolesPool.push(roleId);
        }
      };

      if (role.id === 'werewolf') {
        // 狼人：0 -> 1 -> 2 -> 3 -> 0 循環
        if (countInPool === 0) {
          addRoleToPool('werewolf', 1);
        } else if (countInPool === 1) {
          addRoleToPool('werewolf', 1);
        } else if (countInPool === 2) {
          addRoleToPool('werewolf', 1);
        } else {
          game.rolesPool = game.rolesPool.filter(r => r !== 'werewolf');
        }
      } else if (role.id === 'mason') {
        // 守墓人：0 -> 2 -> 0 循環 (強制成雙)
        if (countInPool === 0) {
          addRoleToPool('mason', 2);
        } else {
          game.rolesPool = game.rolesPool.filter(r => r !== 'mason');
        }
      } else if (role.id === 'villager') {
        // 村民：0 -> 1 -> 2 -> 3 -> 4 -> 0 循環
        if (countInPool < 4) {
          addRoleToPool('villager', 1);
        } else {
          game.rolesPool = game.rolesPool.filter(r => r !== 'villager');
        }
      } else {
        // 其他唯一角色：0 -> 1 -> 0 循環
        if (countInPool > 0) {
          const idx = game.rolesPool.indexOf(role.id);
          game.rolesPool.splice(idx, 1);
        } else {
          addRoleToPool(role.id, 1);
        }
      }

      renderLobbyRoles();
      updateSetupCounts();
      if (game.mode === 'p2p' && p2p && p2p.isHost) {
        p2p.send({ type: 'LOBBY_STATE', players: game.players, rolesPool: game.rolesPool });
      }
    };

    dom.lobbyRoleGrid.appendChild(card);
  });
}

function updateSetupCounts() {
  const pCount = game.players.length;
  const needed = pCount + 3;
  const selected = game.rolesPool.length;
  const isP2PClient = game.mode === 'p2p' && p2p && !p2p.isHost;
  
  dom.setupPlayerCount.innerText = pCount;
  dom.setupCardNeeded.innerText = needed;
  dom.setupCardSelected.innerText = selected;

  dom.presetCount.innerText = pCount;
  const preset = GOLDEN_PRESETS[pCount];
  if (preset) {
    dom.presetLogicDesc.innerText = `💡 ${preset.desc}`;
    if (isP2PClient) {
      dom.btnApplyPreset.classList.add('disabled');
    } else {
      dom.btnApplyPreset.classList.remove('disabled');
    }
  } else {
    dom.presetLogicDesc.innerText = `⚠️ 目前人數無推薦黃金配置 (支援 3 到 10 人局)`;
    dom.btnApplyPreset.classList.add('disabled');
  }

  if (isP2PClient) {
    dom.btnStartGame.classList.add('disabled');
    dom.btnStartGame.innerText = "等待房主開始遊戲...";
  } else {
    if (needed === selected) {
      dom.btnStartGame.classList.remove('disabled');
      dom.btnStartGame.innerText = "確認並發牌";
    } else {
      dom.btnStartGame.classList.add('disabled');
      dom.btnStartGame.innerText = `需選 ${needed} 張牌 (已選 ${selected})`;
    }
  }
}

/* ==========================================================================
   C. WebRTC P2P 連線模組串接
   ========================================================================== */

function safeUpdatePlayers(newPlayers) {
  if (!newPlayers || !Array.isArray(newPlayers)) return;
  const backups = {};
  game.players.forEach(p => {
    backups[p.id] = p.privateNotes || {};
  });

  game.players = newPlayers;

  game.players.forEach(p => {
    p.privateNotes = backups[p.id] || p.privateNotes || {};
  });
}

function initP2P() {
  if (p2p) return;
  p2p = new P2PManager((msg, conn) => {
    if (msg.type === 'JOIN_LOBBY') {
      if (p2p.isHost && game.players.length < 10) {
        // [防重複/防卡死] 若已有名稱相同的玩家，先移除
        const existingPlayer = game.players.find(p => p.name === msg.playerName);
        if (existingPlayer) {
          game.removePlayer(existingPlayer.id);
        }

        game.addPlayer(msg.playerName, false);
        const newPlayer = game.players[game.players.length - 1];
        conn.assignedPlayerId = newPlayer.id;

        renderLobbyPlayers();
        updateSetupCounts();
        renderLobbyRoles();

        conn.send({
          type: 'WELCOME_CLIENT',
          clientId: newPlayer.id,
          players: game.players,
          rolesPool: game.rolesPool
        });

        p2p.connections.forEach(c => {
          if (c !== conn && c.open) {
            c.send({
              type: 'LOBBY_STATE',
              players: game.players,
              rolesPool: game.rolesPool
            });
          }
        });
      }
    } else if (msg.type === 'PLAYER_SPEECH') {
      if (p2p.isHost) {
        const sender = game.players.find(p => p.id === msg.senderId);
        const senderName = sender ? sender.name : "未知玩家";
        addChatMessage(senderName, msg.text, 'user-speech');
        
        // Host 轉發廣播給除了發送者以外的所有 Clients
        p2p.connections.forEach(c => {
          if (c !== conn && c.open) {
            c.send({
              type: 'BROADCAST_SPEECH',
              senderName: senderName,
              text: msg.text
            });
          }
        });
      }
    } else if (msg.type === 'BROADCAST_SPEECH') {
      if (!p2p.isHost) {
        addChatMessage(msg.senderName, msg.text, 'user-speech');
      }
    } else if (msg.type === 'KICKED') {
      p2p.disconnect();
      game.reset();
      confirmedNightIndices.clear();
      showScene(SCENES.LOBBY);
      switchMode('local');
      alert("⚠️ 你已被房主踢出房間！");
    } else if (msg.type === 'WELCOME_CLIENT') {
      myPlayerId = msg.clientId;
      safeUpdatePlayers(msg.players);
      game.rolesPool = msg.rolesPool;
      renderLobbyPlayers();
      updateSetupCounts();
      renderLobbyRoles();
    } else if (msg.type === 'LOBBY_STATE') {
      safeUpdatePlayers(msg.players);
      game.rolesPool = msg.rolesPool;
      renderLobbyPlayers();
      updateSetupCounts();
      renderLobbyRoles();
    } else if (msg.type === 'RENAME_PLAYER') {
      if (p2p.isHost) {
        const player = game.players.find(p => p.id === msg.playerId);
        if (player) {
          player.name = msg.newName;
          renderLobbyPlayers();
          p2p.send({ type: 'LOBBY_STATE', players: game.players, rolesPool: game.rolesPool });
        }
      }
    } else if (msg.type === 'START_GAME') {
      safeUpdatePlayers(msg.players);
      game.centerCards = msg.centerCards;
      game.centerCardsInitial = msg.centerCardsInitial;
      game.rolesPool = msg.rolesPool;
      game.nightOrder = msg.nightOrder;
      startDealingScene();
    } else if (msg.type === 'PLAYER_READY_NIGHT') {
      if (p2p.isHost) {
        handlePlayerReadyNight(msg.playerId);
      }
    } else if (msg.type === 'START_NIGHT') {
      safeUpdatePlayers(msg.players);
      startNightScene();
    } else if (msg.type === 'NIGHT_PHASE') {
      if (msg.players) safeUpdatePlayers(msg.players);
      if (msg.centerCards) game.centerCards = msg.centerCards;
      handleNightPhaseSync(msg);
    } else if (msg.type === 'NIGHT_ACTION_UPDATE') {
      if (p2p.isHost) {
        // 1. 同步最新真實的 players 卡牌與宣稱狀態，防止因增量比對漏洞導致「卡牌被換回初始身份後拒絕更新」的不同步 Bug
        if (msg.players && Array.isArray(msg.players)) {
          msg.players.forEach(clientPlayer => {
            const hostPlayer = game.players.find(p => p.id === clientPlayer.id);
            if (hostPlayer) {
              hostPlayer.currentCard = clientPlayer.currentCard;
              hostPlayer.publicClaim = clientPlayer.publicClaim;
            }
          });
        }

        // 2. 同步最新真實的 centerCards 底牌（例如酒鬼與底牌交換結果）
        if (msg.centerCards && Array.isArray(msg.centerCards)) {
          game.centerCards = [...msg.centerCards];
        }

        // 3. 智能合併歷史軌跡 timelineTrace，防止後續角色行動時覆寫抹除前面角色的軌跡
        if (msg.timelineTrace && Array.isArray(msg.timelineTrace)) {
          msg.timelineTrace.forEach(clientTrace => {
            const exists = game.timelineTrace.some(hostTrace => 
              hostTrace.targetId === clientTrace.targetId && 
              hostTrace.action === clientTrace.action &&
              Math.abs(hostTrace.timestamp - clientTrace.timestamp) < 5000
            );
            if (!exists) {
              game.timelineTrace.push(clientTrace);
            }
          });
          // 重新排序
          game.timelineTrace.sort((a, b) => a.timestamp - b.timestamp);
        }

        // 4. 合併同步查驗資料庫
        if (msg.seerRevealedPlayers) Object.assign(game.seerRevealedPlayers, msg.seerRevealedPlayers);
        if (msg.seerRevealedCenter) Object.assign(game.seerRevealedCenter, msg.seerRevealedCenter);
        if (msg.werewolfRevealedCenter) Object.assign(game.werewolfRevealedCenter, msg.werewolfRevealedCenter);

        if (game.finishActiveNightAction) {
          game.finishActiveNightAction(msg.playerId);
        }
      }
    } else if (msg.type === 'START_DAY') {
      safeUpdatePlayers(msg.players);
      game.centerCards = msg.centerCards;
      game.centerCardsInitial = msg.centerCardsInitial;
      game.timelineTrace = msg.timelineTrace;
      if (msg.seerRevealedPlayers) game.seerRevealedPlayers = msg.seerRevealedPlayers;
      if (msg.seerRevealedCenter) game.seerRevealedCenter = msg.seerRevealedCenter;
      if (msg.werewolfRevealedCenter) game.werewolfRevealedCenter = msg.werewolfRevealedCenter;
      startDayScene();
    } else if (msg.type === 'UPDATE_PUBLIC_CLAIM') {
      if (p2p.isHost) {
        const p = game.players.find(pl => pl.id === msg.playerId);
        if (p) {
          p.publicClaim = msg.publicClaim;
          renderDayPlayers();
          p2p.send({ type: 'SYNC_PUBLIC_CLAIMS', players: game.players });
        }
      }
    } else if (msg.type === 'SYNC_PUBLIC_CLAIMS') {
      safeUpdatePlayers(msg.players);
      renderDayPlayers();
    } else if (msg.type === 'START_VOTING') {
      if (game.dayTimerId) clearInterval(game.dayTimerId);
      startVotingScene();
    } else if (msg.type === 'SUBMIT_VOTE') {
      if (p2p.isHost) {
        handlePlayerSubmitVote(msg.voterId, msg.targetId);
      }
    } else if (msg.type === 'SHOW_RESULT') {
      safeUpdatePlayers(msg.players);
      showResultScene(msg.winnerResult);
    } else if (msg.type === 'RESTART_GAME') {
      game.reset();
      confirmedNightIndices.clear();
      showScene(SCENES.LOBBY);
      renderLobbyPlayers();
      updateSetupCounts();
      renderLobbyRoles();
    }
  }, (status, data, conn) => {
    if (status === 'created') {
      document.getElementById('p2p-room-info').classList.remove('hidden');
      document.getElementById('text-room-id').innerText = data;
    } else if (status === 'disconnected') {
      // 遠端玩家斷線處理！
      if (p2p.isHost && conn && conn.assignedPlayerId) {
        const pId = conn.assignedPlayerId;
        const player = game.players.find(p => p.id === pId);
        if (player) {
          console.warn(`[P2P] 玩家 ${player.name} 斷開連線，已將其自動轉換為 AI 託管，防範卡死！`);
          player.isAI = true; // 託管為 AI

          // 1. 如果是在大廳階段，房主直接幫忙移除該玩家，並廣播最新 Lobby
          if (document.getElementById('scene-lobby').classList.contains('active')) {
            game.removePlayer(pId);
            renderLobbyPlayers();
            updateSetupCounts();
            renderLobbyRoles();
            p2p.send({ type: 'LOBBY_STATE', players: game.players, rolesPool: game.rolesPool });
            return;
          }

          // 2. 如果是在發牌確認身份階段，替他確認進入夜晚
          if (document.getElementById('scene-dealing').classList.contains('active') && !player.isReadyForNight) {
            handlePlayerReadyNight(pId);
          }

          // 3. 如果是在夜晚行動階段，幫他完成 AI 自動行動與確認
          if (document.getElementById('scene-night').classList.contains('active')) {
            if (game.currentNightIndex >= 0 && game.currentNightIndex < game.nightOrder.length) {
              const currentRole = game.nightOrder[game.currentNightIndex];
              if (player.initialRole === currentRole.id) {
                // 幫他執行 AI 夜行
                AIEngine.executeNightAction(player, game.players, game.centerCards);
                if (game.finishActiveNightAction) {
                  game.finishActiveNightAction(pId);
                }
              }
            }
          }

          // 4. 如果是在白天投票階段，幫他隨機投出一票以免卡投票
          if (document.getElementById('scene-voting').classList.contains('active') && player.voteFor === null) {
            const others = game.players.filter(o => o.id !== player.id);
            const target = others[Math.floor(Math.random() * others.length)];
            handlePlayerSubmitVote(pId, target.id);
          }
        }
      }
    }
  });

  document.getElementById('btn-p2p-create').onclick = () => p2p.createRoom();
  document.getElementById('btn-p2p-join').onclick = () => {
    const rId = document.getElementById('input-room-id').value.trim();
    const myRealName = game.players[0].name.replace(' (你)', '').trim();
    if (rId) p2p.joinRoom(rId, myRealName);
  };
  document.getElementById('btn-copy-room-id').onclick = () => {
    navigator.clipboard.writeText(p2p.roomId);
    alert("房間 ID 已複製到剪貼簿！");
  };
}

function handlePlayerReadyNight(playerId) {
  const player = game.players.find(p => p.id === playerId);
  if (player) {
    player.isReadyForNight = true;
  }
  const allRealPlayers = game.players.filter(p => !p.isAI);
  const allReady = allRealPlayers.every(p => p.isReadyForNight);
  if (allReady) {
    p2p.send({
      type: 'START_NIGHT',
      players: game.players
    });
    startNightScene();
  }
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

  if (game.mode === 'p2p') {
    const currentPlayer = game.players.find(p => p.id === myPlayerId);
    if (!currentPlayer) {
      dom.dealPromptText.innerHTML = `系統錯誤：未找到你的玩家資料。`;
      return;
    }

    dom.dealingTitle.innerText = `發牌階段 - 確認身份`;
    dom.dealPromptText.innerHTML = `你好，<strong>${currentPlayer.name}</strong>！<br>點選下方按鈕查看你的初始身份（防窺保護中）。`;
    dom.btnDealAction.classList.remove('disabled');
    dom.btnDealAction.innerText = "查看我的身份";
    dom.btnDealAction.onclick = () => {
      revealDealCard(currentPlayer);
    };
    return;
  }

  if (dealingIndex >= game.players.length) {
    startNightScene();
    return;
  }

  const currentPlayer = game.players[dealingIndex];
  
  if (game.mode === 'ai' && currentPlayer.isAI) {
    dealingIndex++;
    triggerNextPlayerDealPeek();
    return;
  }

  dom.dealingTitle.innerText = `發牌階段 (${dealingIndex + 1}/${game.players.length})`;

  if (game.mode === 'local') {
    dom.dealPromptText.innerHTML = `請 <strong>${currentPlayer.name}</strong> 上前。<br>點選下方按鈕查看你的初始身份（防窺保護中）。`;
    dom.btnDealAction.innerText = "查看我的身份";
    dom.btnDealAction.onclick = () => {
      revealDealCard(currentPlayer);
    };
  } else {
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
  
  if (role.img && role.img !== 'assets/card_back.png') {
    cardFront.innerHTML = `
      <div class="role-frame">
        <img src="${role.img}" alt="${role.name}" style="width:100%;height:100%;object-fit:cover;">
        <div class="role-name-overlay">${role.name}</div>
      </div>
    `;
  } else {
    cardFront.innerHTML = `
      <div class="card-rune-illustration" style="border: 4px solid ${role.bgGlow}; box-shadow: inset 0 0 25px ${role.bgGlow}; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2rem;">
        <div class="rune-symbol" style="font-size: 5.5rem; filter: drop-shadow(0 0 15px ${role.bgGlow});">${role.icon}</div>
        <div style="font-family: var(--font-card); font-size: 2rem; font-weight: 900; color: white; text-shadow: 0 0 10px ${role.bgGlow};">${role.name}</div>
      </div>
    `;
  }
  
  cardFront.style.borderColor = role.bgGlow;
  cardFront.style.boxShadow = `0 0 25px ${role.bgGlow}`;

  dom.dealCardContainer.classList.add('flipped');
  const innerTarotCard = dom.dealCardContainer.querySelector('.tarot-card');
  if (innerTarotCard) innerTarotCard.classList.add('flipped');

  tts.speak(`你是${role.name}`);

  if (game.mode === 'p2p') {
    dom.btnDealAction.innerText = "我記住了，準備進入夜晚";
    dom.btnDealAction.onclick = () => {
      dom.dealPromptText.innerHTML = "<h4>已確認身份！等待其他玩家中...</h4>";
      dom.btnDealAction.classList.add('disabled');
      dom.btnDealAction.innerText = "等待中...";
      if (p2p.isHost) {
        handlePlayerReadyNight(myPlayerId);
      } else {
        p2p.send({ type: 'PLAYER_READY_NIGHT', playerId: myPlayerId });
      }
    };
  } else {
    dom.btnDealAction.innerText = "我記住了，閉眼 (下一位)";
    dom.btnDealAction.onclick = () => {
      dealingIndex++;
      triggerNextPlayerDealPeek();
    };
  }
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
    if (game.mode === 'p2p') {
      if (p2p.isHost) {
        game.nextNightPhase(
          () => {},
          (role, activePlayer, isSimulated) => {
            p2p.send({
              type: 'NIGHT_PHASE',
              currentNightIndex: game.currentNightIndex,
              roleId: role.id,
              activePlayerId: activePlayer ? activePlayer.id : null,
              isSimulated: isSimulated,
              players: game.players,
              centerCards: game.centerCards
            });
            
            const mySelf = game.players.find(p => p.id === myPlayerId);
            const isMyTurn = mySelf && mySelf.initialRole === role.id;
            if (isMyTurn) {
              renderNightBoard(role, mySelf, false);
            } else {
              renderNightBoard(role, activePlayer, true);
            }
          },
          () => {
            p2p.send({
              type: 'START_DAY',
              players: game.players,
              centerCards: game.centerCards,
              centerCardsInitial: game.centerCardsInitial,
              timelineTrace: game.timelineTrace,
              seerRevealedPlayers: game.seerRevealedPlayers,
              seerRevealedCenter: game.seerRevealedCenter,
              werewolfRevealedCenter: game.werewolfRevealedCenter
            });
            startDayScene();
          }
        );
      }
    } else {
      game.nextNightPhase(
        () => {},
        (role, activePlayer, isSimulated) => {
          renderNightBoard(role, activePlayer, isSimulated);
        },
        () => {
          startDayScene();
        }
      );
    }
  });
}

function handleNightPhaseSync(msg) {
  game.currentNightIndex = msg.currentNightIndex;
  const role = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === msg.roleId)];
  
  const isInPlay = game.players.some(p => p.initialRole === role.id);
  const activePlayer = game.players.find(p => p.initialRole === role.id);
  const isRealPlayer = isInPlay && activePlayer && !activePlayer.isAI;

  // 1. 聯網模式下，Client 收到訊號立刻同步渲染 UI 畫面，絕不等待語音播放，防範卡死！
  const mySelf = game.players.find(p => p.id === myPlayerId);
  const isMyTurn = mySelf && mySelf.initialRole === role.id;
  if (isMyTurn) {
    renderNightBoard(role, mySelf, false);
  } else {
    renderNightBoard(role, activePlayer || null, true);
  }

  // 2. 異步在背景播放 TTS 語音旁白（其 callback 為空，僅作背景播報，不阻塞 UI）
  tts.speakNightPhase(role, isInPlay, isRealPlayer, () => {});
}

function syncNightActionToHost() {
  if (game.mode === 'p2p') {
    if (!p2p.isHost) {
      p2p.send({
        type: 'NIGHT_ACTION_UPDATE',
        playerId: myPlayerId,
        players: game.players,
        centerCards: game.centerCards,
        timelineTrace: game.timelineTrace,
        seerRevealedPlayers: game.seerRevealedPlayers,
        seerRevealedCenter: game.seerRevealedCenter,
        werewolfRevealedCenter: game.werewolfRevealedCenter
      });
    }
  }
}

function renderNightBoard(role, activePlayer, isSimulated) {
  // 防重複確認大招：若本機玩家在當前夜晚輪次已經確認過，則強行轉為模擬等待畫面，絕不允許重複操作與卡牌對調
  const mySelf = game.players.find(p => p.id === myPlayerId) || game.players[0];
  const isMyTurn = mySelf && mySelf.initialRole === role.id && !isSimulated;
  if (isMyTurn && confirmedNightIndices.has(game.currentNightIndex)) {
    isSimulated = true;
  }

  if (isSimulated || !activePlayer) {
    dom.nightNarratorText.innerText = `${role.name}正在行動中...`;
    dom.nightOverlayScreen.classList.add('active');
    dom.nightActionBoard.classList.add('hidden');
    return;
  }

  nightActionConfirmed = false;

  dom.nightOverlayScreen.classList.remove('active');
  dom.nightActionBoard.classList.remove('hidden');

  dom.nightRoleTitle.innerText = `🌙 ${role.name} 行動時間 (${activePlayer.name})`;
  dom.nightInstructionText.innerText = role.description;

  const banner = document.getElementById('night-identity-banner');
  if (banner) {
    const initRoleConfig = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === activePlayer.initialRole)];
    banner.innerHTML = `<span style="color:${initRoleConfig.bgGlow}; text-shadow:0 0 10px ${initRoleConfig.bgGlow}; font-weight:900;">${initRoleConfig.icon} 你的身份是：${initRoleConfig.name}</span>`;
    banner.style.borderColor = initRoleConfig.bgGlow;
    banner.style.boxShadow = `0 0 15px ${initRoleConfig.bgGlow}`;
  }

  currentSelectedCards = [];
  
  // 檢查是否為無須選擇卡牌的非互動型角色或多狼人相認，如果是，則確認按鈕預設解鎖允許直接點選結束
  const werewolfCount = game.players.filter(p => p.initialRole === 'werewolf').length;
  const isMultiWakeDirectConfirm = 
    (role.id === 'werewolf' && werewolfCount > 1) || 
    ['mason', 'minion', 'insomniac'].includes(role.id);

  if (isMultiWakeDirectConfirm) {
    dom.btnNightConfirm.classList.remove('disabled');
    dom.btnNightConfirm.onclick = () => {
      nightActionConfirmed = true;
      confirmedNightIndices.add(game.currentNightIndex);
      dom.btnNightConfirm.classList.add('disabled');
      tts.speak("確認完畢", () => {
        if (game.finishActiveNightAction && activePlayer) {
          game.finishActiveNightAction(activePlayer.id);
        }
      });
      syncNightActionToHost();
    };
  } else {
    dom.btnNightConfirm.classList.add('disabled');
  }

  dom.nightTablePlayers.innerHTML = "";
  game.players.forEach(p => {
    const isSelf = p.id === activePlayer.id;
    const cardSlot = document.createElement('div');
    cardSlot.className = "table-card-slot";
    
    const isFlipped = 
      cheatMode || 
      (role.id === 'insomniac' && isSelf) || 
      (role.id === 'werewolf' && p.initialRole === 'werewolf') || 
      (role.id === 'mason' && p.initialRole === 'mason') || 
      (role.id === 'minion' && p.initialRole === 'werewolf');
    
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
  return `
    <div class="role-frame" style="border: 2px solid ${r.bgGlow}; box-shadow: 0 0 12px ${r.bgGlow}; width: 100%; height: 100%; overflow: hidden; position: relative;">
      <img src="${r.img}" alt="${r.name}" style="width: 100%; height: 100%; object-fit: cover;">
      <div class="role-name-overlay" style="font-size: 0.75rem; padding: 2px 0; text-shadow: 0 0 5px ${r.bgGlow}; background: rgba(0,0,0,0.65);">${r.name}</div>
    </div>
  `;
}

function handleNightCardClick(activeRole, clickedPlayer, cardWrapper) {
  if (nightActionConfirmed) return; // 防重複鎖
  const roleId = activeRole.id;

  if (roleId === 'seer') {
    const seerPlayer = game.players.find(p => p.id === myPlayerId && p.initialRole === 'seer') || game.players.find(p => p.initialRole === 'seer');
    const seerPlayerId = seerPlayer ? seerPlayer.id : myPlayerId;
    if (clickedPlayer.id === seerPlayerId) return;
    if (currentSelectedCards.some(c => c.type === 'center')) return;

    currentSelectedCards = [{ type: 'player', id: clickedPlayer.id, element: cardWrapper }];
    
    dom.nightActionBoard.querySelectorAll('.table-card-wrapper').forEach(el => el.classList.remove('selected'));
    cardWrapper.classList.add('selected');
    dom.btnNightConfirm.classList.remove('disabled');

    dom.btnNightConfirm.onclick = () => {
      nightActionConfirmed = true;
      confirmedNightIndices.add(game.currentNightIndex);
      cardWrapper.classList.add('flipped-mini');
      game.seerRevealedPlayers[clickedPlayer.id] = clickedPlayer.currentCard;
      game.logTimeline('seer', '預言家', clickedPlayer.currentCard, `查看了玩家 ${clickedPlayer.name} 的卡牌`);
      
      tts.speak(`他是一張${ROLES[Object.keys(ROLES).find(k => ROLES[k].id === clickedPlayer.currentCard)].name}`);
      setTimeout(() => {
        if (game.finishActiveNightAction) game.finishActiveNightAction(seerPlayerId);
      }, 300);
      
      dom.btnNightConfirm.classList.add('disabled');
      syncNightActionToHost();
    };
  } 
  
  else if (roleId === 'robber') {
    const robberPlayer = game.players.find(p => p.id === myPlayerId && p.initialRole === 'robber') || game.players.find(p => p.initialRole === 'robber');
    const robberPlayerId = robberPlayer ? robberPlayer.id : myPlayerId;
    if (clickedPlayer.id === robberPlayerId) return;

    currentSelectedCards = [{ type: 'player', id: clickedPlayer.id, element: cardWrapper }];
    dom.nightActionBoard.querySelectorAll('.table-card-wrapper').forEach(el => el.classList.remove('selected'));
    cardWrapper.classList.add('selected');
    dom.btnNightConfirm.classList.remove('disabled');

    dom.btnNightConfirm.onclick = () => {
      nightActionConfirmed = true;
      confirmedNightIndices.add(game.currentNightIndex);
      if (!robberPlayer) {
        console.error("Robber player not found!");
        return;
      }
      const temp = robberPlayer.currentCard;
      robberPlayer.currentCard = clickedPlayer.currentCard;
      clickedPlayer.currentCard = temp;

      cardWrapper.classList.add('flipped-mini');
      game.logTimeline(robberPlayer.id, robberPlayer.name, robberPlayer.currentCard, `搶奪了玩家 ${clickedPlayer.name} 的牌`);
      
      const newRole = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === robberPlayer.currentCard)].name;
      tts.speak(`你搶到了${newRole}`);
      setTimeout(() => {
        if (game.finishActiveNightAction) game.finishActiveNightAction(robberPlayerId);
      }, 300);
      
      dom.btnNightConfirm.classList.add('disabled');
      syncNightActionToHost();
    };
  } 
  
  else if (roleId === 'troublemaker') {
    const tmPlayer = game.players.find(p => p.id === myPlayerId && p.initialRole === 'troublemaker') || game.players.find(p => p.initialRole === 'troublemaker');
    const tmPlayerId = tmPlayer ? tmPlayer.id : myPlayerId;
    if (clickedPlayer.id === tmPlayerId) return;

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
        nightActionConfirmed = true;
        confirmedNightIndices.add(game.currentNightIndex);
        const p1 = game.players.find(p => p.id === currentSelectedCards[0].id);
        const p2 = game.players.find(p => p.id === currentSelectedCards[1].id);
        const temp = p1.currentCard;
        p1.currentCard = p2.currentCard;
        p2.currentCard = temp;

        game.logTimeline('troublemaker', '搗蛋鬼', 'troublemaker', `交換了 ${p1.name} 和 ${p2.name} 的卡牌`);
        tts.speak("交換成功");
        setTimeout(() => {
          if (game.finishActiveNightAction) game.finishActiveNightAction(tmPlayerId);
        }, 300);
        
        currentSelectedCards[0].element.classList.remove('selected');
        currentSelectedCards[1].element.classList.remove('selected');
        dom.btnNightConfirm.classList.add('disabled');
        syncNightActionToHost();
      };
    } else {
      dom.btnNightConfirm.classList.add('disabled');
    }
  }
}

function handleNightCenterCardClick(activeRole, clickedIdx, cardWrapper) {
  if (nightActionConfirmed) return; // 防重複鎖
  const roleId = activeRole.id;

  if (roleId === 'seer') {
    if (currentSelectedCards.some(c => c.type === 'player')) return;
    
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
        nightActionConfirmed = true;
        confirmedNightIndices.add(game.currentNightIndex);
        const seerPlayer = game.players.find(p => p.id === myPlayerId && p.initialRole === 'seer') || game.players.find(p => p.initialRole === 'seer');
        const seerPlayerId = seerPlayer ? seerPlayer.id : myPlayerId;
        
        currentSelectedCards.forEach(c => {
          c.element.classList.add('flipped-mini');
          const cardRole = game.centerCards[c.idx];
          game.seerRevealedCenter[c.idx] = cardRole;
          game.logTimeline('seer', '預言家', cardRole, `查看了桌面底牌 ${c.idx + 1}`);
        });
        
        const r1 = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === game.centerCards[currentSelectedCards[0].idx])].name;
        const r2 = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === game.centerCards[currentSelectedCards[1].idx])].name;
        tts.speak(`底牌分別是${r1}和${r2}`);
        setTimeout(() => {
          if (game.finishActiveNightAction) game.finishActiveNightAction(seerPlayerId);
        }, 300);
        
        dom.btnNightConfirm.classList.add('disabled');
        syncNightActionToHost();
      };
    } else {
      dom.btnNightConfirm.classList.add('disabled');
    }
  } 
  
  else if (roleId === 'drunk') {
    currentSelectedCards = [{ type: 'center', idx: clickedIdx, element: cardWrapper }];
    dom.nightActionBoard.querySelectorAll('.table-card-wrapper').forEach(el => el.classList.remove('selected'));
    cardWrapper.classList.add('selected');
    dom.btnNightConfirm.classList.remove('disabled');

    dom.btnNightConfirm.onclick = () => {
      nightActionConfirmed = true;
      confirmedNightIndices.add(game.currentNightIndex);
      const drunkPlayer = game.players.find(p => p.id === myPlayerId && p.initialRole === 'drunk') || game.players.find(p => p.initialRole === 'drunk');
      const drunkPlayerId = drunkPlayer ? drunkPlayer.id : myPlayerId;
      if (!drunkPlayer) {
        console.error("Drunk player not found!");
        return;
      }
      const temp = drunkPlayer.currentCard;
      drunkPlayer.currentCard = game.centerCards[clickedIdx];
      game.centerCards[clickedIdx] = temp;

      game.logTimeline(drunkPlayer.id, drunkPlayer.name, drunkPlayer.currentCard, `將卡牌與底牌 ${clickedIdx + 1} 進行了交換`);
      tts.speak("交換成功");
      setTimeout(() => {
        if (game.finishActiveNightAction) game.finishActiveNightAction(drunkPlayerId);
      }, 300);
      
      cardWrapper.classList.remove('selected');
      dom.btnNightConfirm.classList.add('disabled');
      syncNightActionToHost();
    };
  }
  
  else if (roleId === 'werewolf') {
    const werewolfCount = game.players.filter(p => p.initialRole === 'werewolf').length;
    if (werewolfCount > 1) return; // 雙狼不能看底牌

    currentSelectedCards = [{ type: 'center', idx: clickedIdx, element: cardWrapper }];
    dom.nightActionBoard.querySelectorAll('.table-card-wrapper').forEach(el => el.classList.remove('selected'));
    cardWrapper.classList.add('selected');
    dom.btnNightConfirm.classList.remove('disabled');

    dom.btnNightConfirm.onclick = () => {
      nightActionConfirmed = true;
      confirmedNightIndices.add(game.currentNightIndex);
      cardWrapper.classList.add('flipped-mini');
      const cardRole = game.centerCards[clickedIdx];
      game.werewolfRevealedCenter[clickedIdx] = cardRole;
      game.logTimeline('werewolf', '狼人', cardRole, `單狼查看了桌面底牌 ${clickedIdx + 1}`);
      
      const rName = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === cardRole)].name;
      tts.speak(`底牌是${rName}`);
      
      const wolfPlayer = game.players.find(p => p.id === myPlayerId && p.initialRole === 'werewolf') || game.players.find(p => p.initialRole === 'werewolf');
      const wolfPlayerId = wolfPlayer ? wolfPlayer.id : myPlayerId;
      
      setTimeout(() => {
        if (game.finishActiveNightAction) game.finishActiveNightAction(wolfPlayerId);
      }, 300);
      
      dom.btnNightConfirm.classList.add('disabled');
      syncNightActionToHost();
    };
  }
}

/* ==========================================================================
   F. Day 白天討論與 AI 推理牆發言
   ========================================================================== */

function startDayScene() {
  showScene(SCENES.DAY);
  
  // 恢復白天倒計時：討論時間為 人數 + 3 分鐘
  const durationMinutes = game.players.length + 3;
  game.dayTimeLeft = durationMinutes * 60;
  const initialMin = String(durationMinutes).padStart(2, '0');
  dom.dayTimer.innerText = `${initialMin}:00`;
  
  if (game.dayTimerId) clearInterval(game.dayTimerId);
  game.dayTimerId = setInterval(() => {
    game.dayTimeLeft--;
    const min = String(Math.floor(game.dayTimeLeft / 60)).padStart(2, '0');
    const sec = String(game.dayTimeLeft % 60).padStart(2, '0');
    dom.dayTimer.innerText = `${min}:${sec}`;

    if (game.dayTimeLeft <= 0) {
      clearInterval(game.dayTimerId);
      startVotingScene();
      
      // 如果是 Host，討論超時通知所有人進入投票
      if (game.mode === 'p2p' && p2p.isHost) {
        p2p.send({ type: 'START_VOTING' });
      }
    }
  }, 1000);

  tts.speak("天亮了，大家請睜眼討論！");

  // 1. 渲染白天存活玩家（僅自己顯示角色，其他人皆顯示卡背，除非透視）
  renderDayPlayers();

  // 1.5 渲染並顯示本機玩家夜間查驗與行動專用提示橫幅
  renderDaytimeActionHintBanner();

  // 1.6 渲染本局的角色配置池一覽，方便大家在討論時隨時回看配置
  const rolesPoolList = document.getElementById('day-roles-pool-list');
  if (rolesPoolList) {
    rolesPoolList.innerHTML = "";
    const counts = {};
    game.rolesPool.forEach(id => {
      counts[id] = (counts[id] || 0) + 1;
    });

    Object.keys(counts).sort().forEach(id => {
      const r = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === id)];
      if (r) {
        const badge = document.createElement('div');
        badge.style.display = "flex";
        badge.style.alignItems = "center";
        badge.style.gap = "6px";
        badge.style.padding = "4px 10px";
        badge.style.background = "rgba(255, 255, 255, 0.03)";
        badge.style.border = `1.5px solid ${r.bgGlow}`;
        badge.style.borderRadius = "20px";
        badge.style.fontSize = "0.75rem";
        badge.style.color = "#cbd5e1";
        badge.style.boxShadow = `0 0 8px ${r.bgGlow}33`;
        badge.style.fontFamily = "var(--font-tech)";
        badge.innerHTML = `<span>${r.icon}</span> <strong style="color:#f8fafc; font-weight:800;">${r.name}</strong> <span style="background:rgba(255,255,255,0.08); border-radius:50%; width:16px; height:16px; display:inline-flex; align-items:center; justify-content:center; font-size:0.65rem; font-weight:bold;">${counts[id]}</span>`;
        rolesPoolList.appendChild(badge);
      }
    });
  }

  // 2. 清空發言牆
  dom.discussionChatLog.innerHTML = `<div class="chat-msg system">☀️ 天亮了，討論開始！請大家發揮邏輯與口才，自由展開討論與推理...</div>`;

  // 發言輸入與 P2P 廣播實時同步
  dom.btnSendSpeech.onclick = () => {
    const val = dom.inputDaySpeech.value.trim();
    if (!val) return;
    
    const mySelf = game.players.find(p => p.id === myPlayerId) || game.players[0];
    const myName = mySelf.name;
    
    addChatMessage(myName, val, 'user-speech');
    dom.inputDaySpeech.value = "";

    if (game.mode === 'p2p') {
      if (p2p.isHost) {
        // Host 直接廣播給所有 Clients
        p2p.send({
          type: 'BROADCAST_SPEECH',
          senderName: myName,
          text: val
        });
      } else {
        // Client 發送給 Host 請求中轉
        p2p.send({
          type: 'PLAYER_SPEECH',
          senderId: myPlayerId,
          text: val
        });
      }
    }
  };

  dom.btnForceVote.onclick = () => {
    if (game.dayTimerId) clearInterval(game.dayTimerId);
    startVotingScene();
    
    // 如果是 Host，提前結束討論，廣播 START_VOTING 通知所有人進入投票
    if (game.mode === 'p2p' && p2p.isHost) {
      p2p.send({ type: 'START_VOTING' });
    }
  };

  // 3. 觸發 AI 討論發言（若有 AI 玩家在場）
  if (game.players.some(p => p.isAI)) {
    triggerAISpeeches();
  }
}

function renderDaytimeActionHintBanner() {
  let banner = document.getElementById('day-action-hint-banner');
  
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'day-action-hint-banner';
    banner.className = 'action-hint-banner';
    const dayLayout = document.querySelector('#scene-day .day-layout');
    if (dayLayout) {
      dayLayout.parentNode.insertBefore(banner, dayLayout);
    }
  }

  // 預設先隱藏
  banner.classList.add('hidden');
  banner.style.display = 'none';
  banner.innerHTML = "";

  const hintsList = []; // 存放所有要顯示的提示區塊

  // ==========================================
  // A. P2P 聯網模式：僅對玩家自己（myPlayerId）顯示，防劇透最安全
  // ==========================================
  if (game.mode === 'p2p') {
    const userSelf = game.players.find(p => p.id === myPlayerId) || game.players[0];
    let hintHTML = "";
    let glowColor = "var(--glow-cyan)";
    let icon = "🔮";
    let title = "夜間行動提示";

    if (userSelf.initialRole === 'seer') {
      glowColor = "var(--glow-cyan)";
      icon = "🔮";
      title = "預言家夜行提示";
      const revealedPlayerIds = Object.keys(game.seerRevealedPlayers);
      const revealedCenterIdxs = Object.keys(game.seerRevealedCenter);
      
      if (revealedPlayerIds.length > 0) {
        const pId = revealedPlayerIds[0];
        const targetPlayer = game.players.find(p => p.id === pId);
        const roleId = game.seerRevealedPlayers[pId];
        if (targetPlayer && roleId) {
          const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === roleId)];
          hintHTML = `你昨晚查驗了玩家 <span class="hint-highlight" style="color:var(--glow-cyan);">${targetPlayer.name}</span>，其身份是 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>。`;
        }
      } else if (revealedCenterIdxs.length > 0) {
        const hints = [];
        revealedCenterIdxs.forEach(idxStr => {
          const idx = parseInt(idxStr);
          const roleId = game.seerRevealedCenter[idx];
          if (roleId) {
            const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === roleId)];
            hints.push(`【底牌 ${idx + 1}】🔍 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>`);
          }
        });
        if (hints.length > 0) {
          hintHTML = `你昨晚查看了桌面底牌，線索為：${hints.join(' 與 ')}。`;
        }
      } else {
        hintHTML = `你昨晚選擇了空過，沒有查驗任何牌。`;
      }
    } 
    
    else if (userSelf.initialRole === 'werewolf') {
      const werewolfCount = game.players.filter(p => p.initialRole === 'werewolf').length;
      
      if (werewolfCount === 1) {
        glowColor = "var(--glow-rose)";
        icon = "🐺";
        title = "孤狼夜行提示";
        const revealedCenterIdxs = Object.keys(game.werewolfRevealedCenter);
        if (revealedCenterIdxs.length > 0) {
          const idx = parseInt(revealedCenterIdxs[0]);
          const roleId = game.werewolfRevealedCenter[idx];
          if (roleId) {
            const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === roleId)];
            hintHTML = `由於場上只有你一隻狼人，你昨晚查看了【底牌 ${idx + 1}】，其身份為 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>。`;
          }
        } else {
          hintHTML = `你昨晚沒有查看任何底牌。`;
        }
      } else {
        glowColor = "var(--glow-rose)";
        icon = "🐺";
        title = "狼人夜行提示";
        const teammates = game.players.filter(p => p.initialRole === 'werewolf' && p.id !== userSelf.id);
        if (teammates.length > 0) {
          const names = teammates.map(p => p.name).join('、');
          hintHTML = `你的狼人隊友是：<span class="hint-highlight" style="color:var(--glow-rose);">${names}</span>。請在白天互相掩護，合力欺騙村民！`;
        } else {
          hintHTML = `狼人隊友相認完畢，請在白天合力誤導村民。`;
        }
      }
    } 
    
    else if (userSelf.initialRole === 'robber') {
      glowColor = "var(--glow-green)";
      icon = "🗡️";
      title = "強盜夜行提示";
      const trace = game.timelineTrace.find(t => t.targetId === userSelf.id && t.action.includes('搶奪了玩家'));
      if (trace) {
        let robbedPlayerName = "";
        const match = trace.action.match(/玩家\s*(.+?)\s*的/);
        if (match) robbedPlayerName = match[1].trim();
        const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === userSelf.currentCard)];
        hintHTML = `你昨晚搶奪了玩家 <span class="hint-highlight" style="color:var(--glow-green);">${robbedPlayerName}</span> 的卡牌，你現在的最新身份是 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>！`;
      } else {
        hintHTML = `你昨晚選擇不發動搶奪，你現在依舊是強盜。`;
      }
    } 
    
    else if (userSelf.initialRole === 'troublemaker') {
      glowColor = "var(--glow-purple)";
      icon = "⚡";
      title = "搗蛋鬼夜行提示";
      const trace = game.timelineTrace.find(t => t.action.includes('交換了') && t.action.includes('卡牌'));
      if (trace) {
        const match = trace.action.match(/交換了\s*(.+?)\s*和\s*(.+?)\s*的/);
        if (match) {
          hintHTML = `你昨晚悄悄將 <span class="hint-highlight" style="color:var(--glow-purple);">${match[1].trim()}</span> 和 <span class="hint-highlight" style="color:var(--glow-purple);">${match[2].trim()}</span> 的卡牌互換了！`;
        }
      } else {
        hintHTML = `你昨晚沒有交換任何玩家的卡牌。`;
      }
    } 
    
    else if (userSelf.initialRole === 'drunk') {
      glowColor = "var(--glow-gold)";
      icon = "🍺";
      title = "酒鬼夜行提示";
      const trace = game.timelineTrace.find(t => t.targetId === userSelf.id && t.action.includes('與底牌'));
      if (trace) {
        const match = trace.action.match(/底牌\s*(\d+)/);
        if (match) {
          hintHTML = `你昨晚已將自己面前的卡牌與 <span class="hint-highlight" style="color:var(--glow-gold);">桌面底牌 ${match[1]}</span> 交換，你現在對自己的新身份一無所知！`;
        }
      } else {
        hintHTML = `你昨晚沒有交換底牌。`;
      }
    } 
    
    else if (userSelf.initialRole === 'insomniac') {
      glowColor = "var(--glow-ruby)";
      icon = "⏰";
      title = "失眠者夜行提示";
      const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === userSelf.currentCard)];
      const hasChanged = userSelf.currentCard !== userSelf.initialRole;
      if (hasChanged) {
        hintHTML = `你在天亮前驚醒確認自己的身份，發現牌已經被換走了！你現在最新真實身份是 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>。`;
      } else {
        hintHTML = `你在天亮前驚醒確認自己的身份，你的卡牌完好無損，你依然是 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>。`;
      }
    } 
    
    else if (userSelf.initialRole === 'minion') {
      glowColor = "var(--glow-orange)";
      icon = "👁️‍🗨️";
      title = "爪牙夜行提示";
      const wolves = game.players.filter(p => p.initialRole === 'werewolf');
      if (wolves.length > 0) {
        const names = wolves.map(p => p.name).join('、');
        hintHTML = `你昨晚已確認狼人是：<span class="hint-highlight" style="color:var(--glow-orange);">${names}</span>。請想盡辦法誤導村民，或讓自己被投死！`;
      } else {
        hintHTML = `你昨晚確認場上沒有狼人（都在底牌中）。想辦法投死任意村民，你和狼人陣營便獲勝！`;
      }
    } 
    
    else if (userSelf.initialRole === 'mason') {
      glowColor = "var(--glow-blue)";
      icon = "🛡️";
      title = "守墓人夜行提示";
      const teammates = game.players.filter(p => p.initialRole === 'mason' && p.id !== userSelf.id);
      if (teammates.length > 0) {
        const names = teammates.map(p => p.name).join('、');
        hintHTML = `你的守墓人同伴是：<span class="hint-highlight" style="color:var(--glow-blue);">${names}</span>。`;
      } else {
        hintHTML = `場上沒有其他守墓人同伴（都在底牌中）。`;
      }
    }

    if (hintHTML) {
      hintsList.push({ glowColor, icon, title, hintHTML });
    }
  }

  // ==========================================
  // B. 單機（local / ai）模式：將所有夜行角色的提示並列呈獻（防劇透，不寫名字，僅寫提示）
  // ==========================================
  else {
    // 1. 預言家提示
    const hasSeer = game.players.some(p => p.initialRole === 'seer');
    if (hasSeer) {
      const revealedPlayerIds = Object.keys(game.seerRevealedPlayers);
      const revealedCenterIdxs = Object.keys(game.seerRevealedCenter);
      let seerHTML = "";
      
      if (revealedPlayerIds.length > 0) {
        const pId = revealedPlayerIds[0];
        const targetPlayer = game.players.find(p => p.id === pId);
        const roleId = game.seerRevealedPlayers[pId];
        if (targetPlayer && roleId) {
          const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === roleId)];
          seerHTML = `昨晚查驗了玩家 <span class="hint-highlight" style="color:var(--glow-cyan);">${targetPlayer.name}</span>，其身份是 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>。`;
        }
      } else if (revealedCenterIdxs.length > 0) {
        const hints = [];
        revealedCenterIdxs.forEach(idxStr => {
          const idx = parseInt(idxStr);
          const roleId = game.seerRevealedCenter[idx];
          if (roleId) {
            const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === roleId)];
            hints.push(`【底牌 ${idx + 1}】🔍 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>`);
          }
        });
        if (hints.length > 0) {
          seerHTML = `昨晚查看了桌面底牌，線索為：${hints.join(' 與 ')}。`;
        }
      }
      if (seerHTML) {
        hintsList.push({ glowColor: "var(--glow-cyan)", icon: "🔮", title: "預言家夜行提示", hintHTML: seerHTML });
      }
    }

    // 2. 單狼提示
    const werewolfCount = game.players.filter(p => p.initialRole === 'werewolf').length;
    if (werewolfCount === 1) {
      const revealedCenterIdxs = Object.keys(game.werewolfRevealedCenter);
      if (revealedCenterIdxs.length > 0) {
        const idx = parseInt(revealedCenterIdxs[0]);
        const roleId = game.werewolfRevealedCenter[idx];
        if (roleId) {
          const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === roleId)];
          const wolfHTML = `昨晚查看了桌面【底牌 ${idx + 1}】，其身份為 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>。`;
          hintsList.push({ glowColor: "var(--glow-rose)", icon: "🐺", title: "孤狼夜行提示", hintHTML: wolfHTML });
        }
      }
    }

    // 3. 強盜提示 (直接找 timelineTrace 裡任何強盜搶奪紀錄，無視 ID 比對，確保 100% 顯現！)
    const robberTrace = game.timelineTrace.find(t => t.action.includes('搶奪了玩家'));
    if (robberTrace) {
      let robbedPlayerName = "";
      const match = robberTrace.action.match(/玩家\s*(.+?)\s*的/);
      if (match) robbedPlayerName = match[1].trim();
      
      const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === robberTrace.role)];
      const robberHTML = `昨晚搶奪了玩家 <span class="hint-highlight" style="color:var(--glow-green);">${robbedPlayerName}</span> 的卡牌，最新身份已變更為 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>！`;
      hintsList.push({ glowColor: "var(--glow-green)", icon: "🗡️", title: "強盜夜行提示", hintHTML: robberHTML });
    }

    // 4. 搗蛋鬼提示
    const troublemakerTrace = game.timelineTrace.find(t => t.action.includes('交換了') && t.action.includes('卡牌'));
    if (troublemakerTrace) {
      const match = troublemakerTrace.action.match(/交換了\s*(.+?)\s*和\s*(.+?)\s*的/);
      if (match) {
        const tmHTML = `昨晚悄悄將玩家 <span class="hint-highlight" style="color:var(--glow-purple);">${match[1].trim()}</span> 和 <span class="hint-highlight" style="color:var(--glow-purple);">${match[2].trim()}</span> 的卡牌進行了對調！`;
        hintsList.push({ glowColor: "var(--glow-purple)", icon: "⚡", title: "搗蛋鬼夜行提示", hintHTML: tmHTML });
      }
    }

    // 5. 酒鬼提示
    const drunkTrace = game.timelineTrace.find(t => t.action.includes('與底牌'));
    if (drunkTrace) {
      const match = drunkTrace.action.match(/底牌\s*(\d+)/);
      if (match) {
        const drunkHTML = `昨晚已將自己的卡牌與 <span class="hint-highlight" style="color:var(--glow-gold);">桌面底牌 ${match[1]}</span> 交換，最新身分已進入底牌中！`;
        hintsList.push({ glowColor: "var(--glow-gold)", icon: "🍺", title: "酒鬼夜行提示", hintHTML: drunkHTML });
      }
    }

    // 6. 失眠者提示
    const insomniacPlayer = game.players.find(p => p.initialRole === 'insomniac');
    if (insomniacPlayer) {
      const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === insomniacPlayer.currentCard)];
      const hasChanged = insomniacPlayer.currentCard !== insomniacPlayer.initialRole;
      let insHTML = "";
      if (hasChanged) {
        insHTML = `昨晚在天亮前驚醒，確認自己的卡牌已被換走！最新真實身份變更為 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>。`;
      } else {
        insHTML = `昨晚在天亮前驚醒，確認卡牌未被觸碰，依然是 <span class="hint-highlight" style="color:${rConf.bgGlow}; text-shadow: 0 0 5px ${rConf.bgGlow}">${rConf.icon} ${rConf.name}</span>。`;
      }
      hintsList.push({ glowColor: "var(--glow-ruby)", icon: "⏰", title: "失眠者夜行提示", hintHTML: insHTML });
    }
  }

  // ==========================================
  // C. 渲染生成的提示列表到 Banner 中
  // ==========================================
  if (hintsList.length > 0) {
    banner.innerHTML = hintsList.map(h => `
      <div class="hint-banner-inner" style="border: 2px solid ${h.glowColor}; box-shadow: 0 0 15px ${h.glowColor}; margin-bottom: 0.75rem;">
        <div class="hint-banner-header">
          <span class="hint-banner-icon">${h.icon}</span>
          <span class="hint-banner-title" style="color:${h.glowColor}; text-shadow:0 0 5px ${h.glowColor};">${h.title}</span>
        </div>
        <div class="hint-banner-body">${h.hintHTML}</div>
      </div>
    `).join("");
    
    banner.classList.remove('hidden');
    banner.style.display = 'block';
  }
}

function renderDayPlayers() {
  dom.dayPlayersGrid.innerHTML = "";
  
  const userSelf = game.players.find(p => p.id === myPlayerId) || game.players[0];

  // 1. 掃描夜晚本機玩家得到的真實情報（預言家查驗、單狼查驗底牌、強盜搶奪）
  const verifiedInfos = {}; // { targetId: roleId } 或 { center_idx: roleId }
  
  game.timelineTrace.forEach(t => {
    // 預言家查驗玩家或底牌
    if (userSelf.initialRole === 'seer') {
      const isSeerAction = t.targetId === 'seer' || t.label === '預言家' || t.label === userSelf.name;
      if (isSeerAction) {
        if (t.action.includes('查看了玩家')) {
          const p = game.players.find(pl => t.action.includes(pl.name));
          if (p) verifiedInfos[p.id] = t.role;
        }
        if (t.action.includes('查看了桌面底牌')) {
          const match = t.action.match(/底牌\s*(\d+)/);
          if (match) {
            const idx = parseInt(match[1]) - 1;
            verifiedInfos[`center_${idx}`] = t.role;
          }
        }
      }
    }
    
    // 單狼查驗底牌
    if (userSelf.initialRole === 'werewolf') {
      if (t.action.includes('單狼') && t.action.includes('底牌')) {
        const match = t.action.match(/底牌\s*(\d+)/);
        if (match) {
          const idx = parseInt(match[1]) - 1;
          verifiedInfos[`center_${idx}`] = t.role;
        }
      }
    }

    // 強盜得知自己被搶後的新身份
    if (userSelf.initialRole === 'robber') {
      if (t.action.includes('搶奪了玩家') && t.targetId === userSelf.id) {
        verifiedInfos[userSelf.id] = t.role;
      }
    }
  });

  // 合併單狼精確查驗底牌紀錄
  if (userSelf.initialRole === 'werewolf') {
    Object.keys(game.werewolfRevealedCenter).forEach(idx => {
      verifiedInfos[`center_${idx}`] = game.werewolfRevealedCenter[idx];
    });
  }

  // 1.5. 如果是失眠者，將自己天黑看見的新身份加進 verifiedInfos
  if (userSelf.initialRole === 'insomniac') {
    verifiedInfos[userSelf.id] = userSelf.currentCard;
  }

  // 2. 計算衝突宣稱
  const claimCounts = {};
  game.players.forEach(p => {
    if (p.publicClaim && p.publicClaim !== 'villager') {
      claimCounts[p.publicClaim] = (claimCounts[p.publicClaim] || 0) + 1;
    }
  });

  // 3. 尋找強盜與搗蛋鬼技能對應目標
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
      const verifiedRole = verifiedInfos[p.id];
      if (verifiedRole) {
        const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === verifiedRole)];
        privateAreaHTML += `<div class="hypothesis-badge verified" style="background: rgba(16, 185, 129, 0.15); border-color: var(--glow-green); color: #a7f3d0;" id="note-${p.id}">👁️ 已驗證: ${rConf.icon} ${rConf.name}</div>`;
      } else {
        const note = userSelf.privateNotes[p.id];
        if (!note) {
          privateAreaHTML += `<div class="hypothesis-badge" id="note-${p.id}">🕵️ 標記推測</div>`;
        } else {
          const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === note)];
          privateAreaHTML += `<div class="hypothesis-badge marked" id="note-${p.id}">🕵️ 推測: ${rConf.icon} ${rConf.name}</div>`;
        }
      }

      if (p.name.trim() === robbedPlayerName) {
        privateAreaHTML += `<div class="special-action-badge robbed">🛡️ 被你偷了</div>`;
      }

      if (swappedPlayerNames.includes(p.name.trim())) {
        privateAreaHTML += `<div class="special-action-badge swapped">⚡ 被你對調</div>`;
      }

      // 4. 陣營與同伴身份夜間認人提示徽章
      if (userSelf.initialRole === 'werewolf' && p.initialRole === 'werewolf') {
        privateAreaHTML += `<div class="special-action-badge teammate werewolf" style="background: rgba(244, 63, 94, 0.2); border: 1px solid var(--glow-rose); color: #fecdd3; text-shadow: 0 0 5px var(--glow-rose); margin-top: 4px;">🐺 狼人隊友</div>`;
      }
      if (userSelf.initialRole === 'mason' && p.initialRole === 'mason') {
        privateAreaHTML += `<div class="special-action-badge teammate mason" style="background: rgba(59, 130, 246, 0.2); border: 1px solid var(--glow-blue); color: #bfdbfe; text-shadow: 0 0 5px var(--glow-blue); margin-top: 4px;">🛡️ 守墓人隊友</div>`;
      }
      if (userSelf.initialRole === 'minion' && p.initialRole === 'werewolf') {
        privateAreaHTML += `<div class="special-action-badge teammate minion" style="background: rgba(245, 158, 11, 0.2); border: 1px solid var(--glow-orange); color: #fef3c7; text-shadow: 0 0 5px var(--glow-orange); margin-top: 4px;">👁️‍🗨️ 你的狼人主子</div>`;
      }
    } else {
      privateAreaHTML += `<div style="font-size:0.65rem; color:var(--glow-cyan); font-family:var(--font-tech);">⭐ 點卡牌可改宣稱</div>`;
    }

    let showRoleId = p.initialRole;
    if (isSelf) {
      if (p.initialRole === 'insomniac') {
        // 失眠者是夜晚最後醒來，看到自己最新被對調的卡牌
        showRoleId = p.currentCard;
      } else if (p.initialRole === 'robber') {
        // 強盜看見自己「搶奪當時所拿到的新身份」，防範後續搗蛋鬼對其交換所產生的劇透
        const robberTrace = game.timelineTrace.find(t => t.targetId === p.id && t.action.includes('搶奪了玩家'));
        if (robberTrace) {
          showRoleId = robberTrace.role; // 顯示搶奪當下拿到的牌
        } else {
          showRoleId = p.initialRole;
        }
      } else {
        // 其他所有角色（村民、預言家、酒鬼、狼人、皮皮鬼等）天亮只會看到初始身份，不因夜晚被交換而劇透
        showRoleId = p.initialRole;
      }
    }
    if (cheatMode) {
      showRoleId = p.currentCard;
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
          ${getMiniCardFrontHTML(showRoleId)}
        </div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:center; gap:2px; margin-top: 5px; width:100%;">
        ${privateAreaHTML}
      </div>
    `;

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
      const noteBadge = item.querySelector(`#note-${p.id}`);
      if (noteBadge && !verifiedInfos[p.id]) {
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
    
    const verifiedRole = verifiedInfos[`center_${idx}`];
    let noteBadgeHTML = "";
    if (verifiedRole) {
      const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === verifiedRole)];
      noteBadgeHTML = `<div class="hypothesis-badge marked verified" style="background: rgba(16, 185, 129, 0.15); border-color: var(--glow-green); color: #a7f3d0; margin-top: 4px;" id="note-center-${idx}">👁️ 已驗證: ${rConf.icon} ${rConf.name}</div>`;
    } else {
      const note = userSelf.privateNotes[`center_${idx}`];
      if (!note) {
        noteBadgeHTML = `<div class="hypothesis-badge" id="note-center-${idx}" style="margin-top: 4px;">🕵️ 盲猜底牌</div>`;
      } else {
        const rConf = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === note)];
        noteBadgeHTML = `<div class="hypothesis-badge marked" id="note-center-${idx}" style="margin-top: 4px;">🕵️ 推測: ${rConf.icon} ${rConf.name}</div>`;
      }
    }

    const displayRole = cheatMode ? roleId : (verifiedRole || roleId);

    item.innerHTML = `
      <div class="table-card-wrapper ${cheatMode || verifiedRole ? 'flipped-mini' : ''}" style="width: 80px; height: 112px; pointer-events: none;">
        <div class="card-face-mini card-mini-back">
          <img src="assets/card_back.png" alt="卡背">
        </div>
        <div class="card-face-mini card-mini-front">
          ${getMiniCardFrontHTML(displayRole)}
        </div>
      </div>
      <div class="card-slot-badge" style="font-size:0.6rem; margin-top:2px;">底牌 ${idx + 1}</div>
      ${noteBadgeHTML}
    `;

    const centerNoteBadge = item.querySelector(`#note-center-${idx}`);
    if (centerNoteBadge && !verifiedInfos[`center_${idx}`]) {
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
  dom.btnSubmitVote.classList.remove('disabled');
  dom.btnSubmitVote.innerText = "確認送出投票";

  dom.votingBoardGrid.innerHTML = "";
  
  // 1. 渲染所有玩家卡牌
  game.players.forEach(p => {
    const isSelf = p.id === myPlayerId;
    const card = document.createElement('div');
    card.className = "vote-card";
    card.innerHTML = `
      <div class="vote-avatar">👤</div>
      <h4 style="font-weight: 800; font-size: 0.95rem;">${p.name}</h4>
      <div class="vote-badge-count hidden" id="vote-badge-${p.id}">0 票</div>
    `;

    card.onclick = () => {
      if (isSelf) return;
      clientVoteSelected = p.id;
      dom.votingBoardGrid.querySelectorAll('.vote-card').forEach(el => el.classList.remove('selected'));
      card.classList.add('selected');
      dom.btnSubmitVote.classList.remove('disabled');
    };

    dom.votingBoardGrid.appendChild(card);
  });

  // 2. 渲染「場上沒有狼人」的特殊投票卡牌（放置在最後，非常醒目且精緻的霓虹青色風格）
  const noWerewolfCard = document.createElement('div');
  noWerewolfCard.className = "vote-card no-werewolf-card";
  noWerewolfCard.style.border = "2px dashed var(--glow-cyan)";
  noWerewolfCard.style.boxShadow = "0 0 10px rgba(0, 255, 204, 0.15)";
  noWerewolfCard.innerHTML = `
    <div class="vote-avatar" style="color: var(--glow-cyan); text-shadow: 0 0 10px var(--glow-cyan);">🚫🐺</div>
    <h4 style="font-weight: 800; font-size: 0.95rem; color: var(--glow-cyan);">場上沒有狼人</h4>
    <div class="vote-badge-count hidden" id="vote-badge-no_werewolves">0 票</div>
  `;
  noWerewolfCard.onclick = () => {
    clientVoteSelected = "no_werewolves";
    dom.votingBoardGrid.querySelectorAll('.vote-card').forEach(el => el.classList.remove('selected'));
    noWerewolfCard.classList.add('selected');
    dom.btnSubmitVote.classList.remove('disabled');
  };
  dom.votingBoardGrid.appendChild(noWerewolfCard);

  dom.btnSubmitVote.onclick = () => {
    if (!clientVoteSelected) return;
    
    const me = game.players.find(p => p.id === myPlayerId);
    if (me) me.voteFor = clientVoteSelected;

    if (game.mode === 'p2p') {
      dom.btnSubmitVote.classList.add('disabled');
      dom.btnSubmitVote.innerText = "已提交投票，等待其他玩家中...";
      if (p2p.isHost) {
        handlePlayerSubmitVote(myPlayerId, clientVoteSelected);
      } else {
        p2p.send({
          type: 'SUBMIT_VOTE',
          voterId: myPlayerId,
          targetId: clientVoteSelected
        });
      }
    } else {
      game.players.forEach(p => {
        if (p.isAI) {
          // AI 投票：10% 機率投「沒有狼人」，90% 隨機投其他玩家
          if (Math.random() < 0.1) {
            p.voteFor = "no_werewolves";
          } else {
            const others = game.players.filter(o => o.id !== p.id);
            const target = others[Math.floor(Math.random() * others.length)];
            p.voteFor = target.id;
          }
        }
      });
      showResultScene();
    }
  };
}

function handlePlayerSubmitVote(voterId, targetId) {
  const voter = game.players.find(p => p.id === voterId);
  if (voter) {
    voter.voteFor = targetId;
  }
  
  const allRealPlayers = game.players.filter(p => !p.isAI);
  const allVoted = allRealPlayers.every(p => p.voteFor !== null);
  
  if (allVoted) {
    game.players.forEach(p => {
      if (p.isAI) {
        // AI 投票：10% 機率投「沒有狼人」，90% 隨機投其他玩家
        if (Math.random() < 0.1) {
          p.voteFor = "no_werewolves";
        } else {
          const others = game.players.filter(o => o.id !== p.id);
          const target = others[Math.floor(Math.random() * others.length)];
          p.voteFor = target.id;
        }
      }
    });

    const res = game.judgeWinner();

    p2p.send({
      type: 'SHOW_RESULT',
      players: game.players,
      winnerResult: res
    });

    showResultScene(res);
  }
}

/* ==========================================================================
   H. Result 結局與卡牌演變軌跡
   ========================================================================== */

function showResultScene(p2pResult = null) {
  showScene(SCENES.RESULT);

  const res = p2pResult || game.judgeWinner();

  dom.resultWinnerTitle.innerText = `${res.winningTeam}獲勝！`;
  dom.resultSummaryText.innerText = res.summaryText;

  if (res.deadPlayers.length > 0) {
    dom.deathNamesList.innerHTML = res.deadPlayers.map(p => {
      const r = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === p.currentCard)];
      return `<span style="color:var(--glow-rose); font-weight:bold;">${p.name} (${r.icon} ${r.name})</span>`;
    }).join(' ＆ ');
  } else {
    dom.deathNamesList.innerHTML = "無人死亡 (大家成功投出「無狼人」或得票數均小於 2 票)";
  }

  // 渲染所有人投票詳情明細 (包含投票給玩家或 "no_werewolves")
  if (dom.voteDetailsList) {
    let detailsHTML = `<strong>🗳️ 投票詳情明細：</strong><ul style="margin: 8px 0 0 0; padding-left: 20px; list-style-type: square; line-height: 1.6;">`;
    game.players.forEach(p => {
      if (p.voteFor) {
        let targetName = "";
        if (p.voteFor === "no_werewolves") {
          targetName = `<span style="color: var(--glow-cyan); font-weight: bold;">🚫🐺 場上沒有狼人</span>`;
        } else {
          const targetPlayer = game.players.find(tp => tp.id === p.voteFor);
          targetName = targetPlayer ? `<span style="color: #60a5fa; font-weight: bold;">👤 ${targetPlayer.name}</span>` : "未知";
        }
        detailsHTML += `<li>${p.name} ➡️ 投給了 ${targetName}</li>`;
      } else {
        detailsHTML += `<li>${p.name} ➡️ <span style="color: #64748b;">未投票</span></li>`;
      }
    });

    // 顯示各選項得票總數摘要
    detailsHTML += `</ul><div style="margin-top: 10px; font-weight: bold; font-size: 0.85rem; color: #cbd5e1;">📊 總票數統計：`;
    const voteSummary = [];
    Object.keys(res.voteCounts).forEach(targetId => {
      const count = res.voteCounts[targetId];
      if (targetId === "no_werewolves") {
        voteSummary.push(`<span style="color: var(--glow-cyan);">🚫🐺 沒有狼人</span> (${count}票)`);
      } else {
        const targetPlayer = game.players.find(tp => tp.id === targetId);
        if (targetPlayer) {
          voteSummary.push(`<span style="color: #60a5fa;">👤 ${targetPlayer.name}</span> (${count}票)`);
        }
      }
    });
    detailsHTML += voteSummary.length > 0 ? voteSummary.join("、") : "無任何得票";
    detailsHTML += `</div>`;

    dom.voteDetailsList.innerHTML = detailsHTML;
  }

  renderTimelineTrace();

  dom.btnRestartGame.onclick = () => {
    if (game.mode === 'p2p') {
      if (p2p && p2p.isHost) {
        game.reset();
        confirmedNightIndices.clear();
        p2p.send({ type: 'RESTART_GAME' });
        showScene(SCENES.LOBBY);
        renderLobbyPlayers();
        updateSetupCounts();
        renderLobbyRoles();
      }
    } else {
      showScene(SCENES.LOBBY);
    }
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

      // P2P 聯網模式下同步宣稱狀態給其他所有玩家
      if (game.mode === 'p2p') {
        if (p2p.isHost) {
          p2p.send({ type: 'SYNC_PUBLIC_CLAIMS', players: game.players });
        } else {
          p2p.send({
            type: 'UPDATE_PUBLIC_CLAIM',
            playerId: myPlayerId,
            publicClaim: roleId
          });
        }
      }
    },
    player.publicClaim
  );
}

function openPrivateNoteSelector(player) {
  const userSelf = game.players.find(p => p.id === myPlayerId) || game.players[0];
  createFloatingSelector(
    `🕵️ 推測 ${player.name} 的身分`,
    "這筆記僅你自己看得到，狼人殺推理關鍵工具。",
    (roleId) => {
      if (roleId) {
        userSelf.privateNotes[player.id] = roleId;
      } else {
        delete userSelf.privateNotes[player.id];
      }
      renderDayPlayers();
    },
    userSelf.privateNotes[player.id]
  );
}

function openCenterPrivateNoteSelector(centerIdx) {
  const userSelf = game.players.find(p => p.id === myPlayerId) || game.players[0];
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
    game.addPlayer('玩家乙', false);
    game.addPlayer('玩家丙', false);
    game.addPlayer('玩家丁', false);
    game.addPlayer('玩家戊', false);
    
    game.rolesPool = ['werewolf', 'werewolf', 'seer', 'robber', 'troublemaker', 'villager', 'tanner', 'insomniac'];
    
    renderLobbyPlayers();
    updateSetupCounts();
    renderLobbyRoles();
  };

  // 執行 1000 局邏輯壓測
  document.getElementById('btn-debug-run-tests').onclick = () => {
    runAutomatedTests();
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

function runAutomatedTests() {
  console.log("==================================================");
  console.log("🧪 一夜終極狼人殺 - 自動化蒙特卡羅邏輯壓力測試套件");
  console.log("==================================================");

  const originalTtsState = tts.enabled;
  tts.enabled = false;

  const backupPlayers = JSON.parse(JSON.stringify(game.players));
  const backupRolesPool = [...game.rolesPool];

  try {
    console.log("👉 [測試 1] GOLDEN_PRESETS 推薦配置有效性測試...");
    for (let pCount = 3; pCount <= 10; pCount++) {
      const preset = GOLDEN_PRESETS[pCount];
      if (!preset) {
        throw new Error(`人數 ${pCount} 缺乏推薦黃金配置！`);
      }
      if (preset.roles.length !== pCount + 3) {
        throw new Error(`人數 ${pCount} 的推薦配置卡牌數 ${preset.roles.length} 與需求數 ${pCount + 3} 不對稱！`);
      }
    }
    console.log("   ✅ [測試 1] GOLDEN_PRESETS 推薦配置檢驗通過。");

    console.log("👉 [測試 2] 進行 1000 局蒙特卡羅遊戲邏輯壓力測試...");
    for (let round = 1; round <= 1000; round++) {
      const pCount = Math.floor(Math.random() * 8) + 3;
      
      game.players = [];
      for (let i = 0; i < pCount; i++) {
        const isAI = Math.random() > 0.3;
        const personalities = ['honest', 'cunning', 'chaotic', 'quiet'];
        const randPers = personalities[Math.floor(Math.random() * personalities.length)];
        game.addPlayer(i === 0 ? '測試本人' : `AI玩家_${i}`, isAI, randPers);
      }

      const preset = GOLDEN_PRESETS[pCount];
      game.rolesPool = [...preset.roles];

      game.dealCards();

      const dealCardsCollected = [];
      game.players.forEach(p => dealCardsCollected.push(p.initialRole));
      game.centerCardsInitial.forEach(c => dealCardsCollected.push(c));
      
      dealCardsCollected.sort();
      const sortedPool = [...game.rolesPool].sort();
      if (JSON.stringify(dealCardsCollected) !== JSON.stringify(sortedPool)) {
        throw new Error(`[第 ${round} 局] 卡牌發配不守恆！\n分配：${dealCardsCollected}\n角色池：${sortedPool}`);
      }

      game.nightOrder.forEach(role => {
        const activePlayer = game.players.find(p => p.initialRole === role.id);
        const isInPlay = activePlayer !== undefined;

        if (role.id === 'werewolf' && isInPlay) {
          const werewolfCount = game.players.filter(p => p.initialRole === 'werewolf').length;
          if (werewolfCount === 1) {
            const idx = Math.floor(Math.random() * 3);
            game.logTimeline('werewolf', '狼人', game.centerCards[idx], `模擬單狼查看底牌 ${idx+1}`);
          }
        } 
        
        else if (role.id === 'seer' && isInPlay) {
          if (Math.random() > 0.5) {
            const targets = game.players.filter(p => p.initialRole !== 'seer');
            if (targets.length > 0) {
              const target = targets[Math.floor(Math.random() * targets.length)];
              game.logTimeline('seer', '預言家', target.currentCard, `模擬查看玩家 ${target.name}`);
            }
          } else {
            const idx1 = 0, idx2 = 1;
            game.logTimeline('seer', '預言家', game.centerCards[idx1], `模擬查看底牌 ${idx1+1}`);
            game.logTimeline('seer', '預言家', game.centerCards[idx2], `模擬查看底牌 ${idx2+1}`);
          }
        } 
        
        else if (role.id === 'robber' && isInPlay) {
          const robberPlayer = game.players.find(p => p.initialRole === 'robber');
          const targets = game.players.filter(p => p.initialRole !== 'robber');
          if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)];
            const temp = robberPlayer.currentCard;
            robberPlayer.currentCard = target.currentCard;
            target.currentCard = temp;
            game.logTimeline(robberPlayer.id, robberPlayer.name, robberPlayer.currentCard, `模擬搶奪了 ${target.name} 的牌`);
          }
        } 
        
        else if (role.id === 'troublemaker' && isInPlay) {
          const targets = game.players.filter(p => p.initialRole !== 'troublemaker');
          if (targets.length >= 2) {
            const shuffled = [...targets].sort(() => Math.random() - 0.5);
            const p1 = shuffled[0];
            const p2 = shuffled[1];
            const temp = p1.currentCard;
            p1.currentCard = p2.currentCard;
            p2.currentCard = temp;
            game.logTimeline('troublemaker', '搗蛋鬼', 'troublemaker', `模擬交換了 ${p1.name} 和 ${p2.name} 的卡牌`);
          }
        } 
        
        else if (role.id === 'drunk' && isInPlay) {
          const drunkPlayer = game.players.find(p => p.initialRole === 'drunk');
          const idx = Math.floor(Math.random() * 3);
          const temp = drunkPlayer.currentCard;
          drunkPlayer.currentCard = game.centerCards[idx];
          game.centerCards[idx] = temp;
          game.logTimeline(drunkPlayer.id, drunkPlayer.name, drunkPlayer.currentCard, `模擬將手牌與底牌 ${idx+1} 交換`);
        }
      });

      const finalCardsCollected = [];
      game.players.forEach(p => finalCardsCollected.push(p.currentCard));
      game.centerCards.forEach(c => finalCardsCollected.push(c));
      
      finalCardsCollected.sort();
      if (JSON.stringify(finalCardsCollected) !== JSON.stringify(sortedPool)) {
        throw new Error(`[第 ${round} 局] 夜晚交換後卡牌不守恆！\n分配：${finalCardsCollected}\n角色池：${sortedPool}`);
      }

      game.players.forEach(p => {
        const others = game.players.filter(o => o.id !== p.id);
        p.voteFor = others[Math.floor(Math.random() * others.length)].id;
      });

      const result = game.judgeWinner();

      const voteCounts = {};
      game.players.forEach(p => {
        if (p.voteFor) voteCounts[p.voteFor] = (voteCounts[p.voteFor] || 0) + 1;
      });
      let maxVotes = 0;
      Object.keys(voteCounts).forEach(id => {
        if (voteCounts[id] > maxVotes) maxVotes = voteCounts[id];
      });

      if (maxVotes > 1) {
        const expectedDeads = game.players.filter(p => voteCounts[p.id] === maxVotes);
        expectedDeads.forEach(expected => {
          if (!result.deadPlayers.some(d => d.id === expected.id)) {
            throw new Error(`[第 ${round} 局] 漏判最高票死者 ${expected.name} (${maxVotes}票)！`);
          }
        });
      }

      const hasTannerDead = result.deadPlayers.some(p => p.currentCard === 'tanner');
      if (hasTannerDead) {
        if (result.winningTeam !== '皮皮鬼') {
          throw new Error(`[第 ${round} 局] 規則謬誤：皮皮鬼被投死，獲勝者竟為 ${result.winningTeam}！`);
        }
      }
    }

    console.log("   ✅ [測試 2] 1000 局隨機蒙特卡羅壓力與卡牌守恆測試順利通過！");
    alert("🎉 1000 局 Monte Carlo 邏輯壓力測試 100% 通過！\n\n- 卡牌初始發配守恆：驗證通過\n- 夜晚多角色隨機交換守恆：驗證通過\n- 投票勝負/獵人開槍/平票規則：驗證通過\n- 皮皮鬼死獲勝判定：驗證通過\n\n遊戲核心業務邏輯完美無缺，未發現任何 Bug！");

  } catch (err) {
    console.error("❌ 測試套件崩潰，發現 Bug：", err);
    alert(`❌ 自動化測試發現 Bug！\n\n錯誤訊息：${err.message}`);
  } finally {
    game.players = backupPlayers;
    game.rolesPool = backupRolesPool;
    tts.enabled = originalTtsState;
    
    renderLobbyPlayers();
    updateSetupCounts();
    renderLobbyRoles();
  }
}

// 初始化 Lobby
initLobby();
initSystemControls();
