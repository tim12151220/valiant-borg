/* ==========================================================================
   《一夜終極狼人殺》- 核心狀態機與遊戲邏輯 (js/state.js)
   ========================================================================== */

import { ROLES, getNightOrder } from './roles.js';
import { AIEngine } from './ai.js';
import { tts } from './tts.js';

export const SCENES = {
  LOBBY: 'scene-lobby',
  DEALING: 'scene-dealing',
  NIGHT: 'scene-night',
  DAY: 'scene-day',
  VOTING: 'scene-voting',
  RESULT: 'scene-result'
};

export class GameState {
  constructor() {
    this.mode = 'local'; // 'local' (Pass & Play), 'ai' (AI Sandbox), 'p2p' (WebRTC)
    this.players = [];   // Player 陣列
    this.rolesPool = []; // 本局選用的角色 ID 陣列 (總數 = 玩家數 + 3)
    this.centerCards = []; // 三張桌面底牌的「當前角色 ID」
    this.centerCardsInitial = []; // 三張桌面底牌的「初始角色 ID」
    
    // 遊戲運行中狀態
    this.currentScene = SCENES.LOBBY;
    this.nightOrder = []; // 依序需要行動的角色陣列
    this.currentNightIndex = -1; // 當前夜晚行動角色的 index
    
    // 遊戲時間與歷史軌跡
    this.dayTimerId = null;
    this.dayTimeLeft = 180; // 白天討論 3 分鐘
    this.timelineTrace = []; // 紀錄所有卡牌移動軌跡
    
    // 預言家查驗紀錄
    this.seerRevealedPlayers = {}; // { playerId: roleId }
    this.seerRevealedCenter = {};  // { centerCardIdx: roleId }

    // 單狼查驗底牌紀錄
    this.werewolfRevealedCenter = {}; // { centerCardIdx: roleId }
  }

  /**
   * 初始化/重設遊戲
   */
  reset() {
    this.players.forEach(p => {
      p.initialRole = null;
      p.currentCard = null;
      p.voteFor = null;
      p.isReadyForNight = false; // 徹底重設準備夜晚狀態，防止第二局卡死或強行進天黑
      this.dayTimeLeft = 180;
      p.speech = "";
      p.publicClaim = null; // 宣稱身份
      p.privateNotes = {};  // 推理筆記
    });
    this.centerCards = [];
    this.centerCardsInitial = [];
    this.timelineTrace = [];
    this.currentNightIndex = -1;
    this.seerRevealedPlayers = {};
    this.seerRevealedCenter = {};
    this.werewolfRevealedCenter = {};
    if (this.dayTimerId) {
      clearInterval(this.dayTimerId);
      this.dayTimerId = null;
    }
  }

  /**
   * 新增玩家
   */
  addPlayer(name, isAI = false, aiPersonality = 'normal') {
    const id = 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000000) + '_' + this.players.length;
    this.players.push({
      id,
      name,
      isAI,
      aiPersonality,
      initialRole: null,
      currentCard: null,
      voteFor: null,
      speech: "",
      publicClaim: null, // 宣稱身份
      privateNotes: {}   // 推理筆記
    });
    return this.players;
  }

  /**
   * 移除玩家
   */
  removePlayer(id) {
    this.players = this.players.filter(p => p.id !== id);
  }

  /**
   * 洗牌並發牌
   */
  dealCards() {
    this.reset();
    
    // 複製一份選定的角色池
    const shuffledRoles = [...this.rolesPool].sort(() => Math.random() - 0.5);

    // 1. 分配給玩家
    this.players.forEach((player, idx) => {
      const assignedRole = shuffledRoles[idx];
      player.initialRole = assignedRole;
      player.currentCard = assignedRole;
      
      // 記錄初始軌跡
      this.logTimeline(player.id, player.name, assignedRole, '初始分配');
    });

    // 2. 剩下的 3 張作為底牌
    this.centerCards = shuffledRoles.slice(this.players.length);
    this.centerCardsInitial = [...this.centerCards];

    // 記錄底牌初始軌跡
    this.centerCards.forEach((role, idx) => {
      this.logTimeline(`center_${idx}`, `底牌 ${idx + 1}`, role, '初始分配');
    });

    console.log("Dealing completed:", {
      players: this.players.map(p => ({ name: p.name, role: p.initialRole })),
      center: this.centerCards
    });

    // 計算夜晚的優先級行動順序
    this.nightOrder = getNightOrder(this.rolesPool);
  }

  /**
   * 記錄卡牌的移動與查看歷史，便於最後畫出神級軌跡圖
   */
  logTimeline(id, label, role, actionText) {
    this.timelineTrace.push({
      timestamp: Date.now(),
      targetId: id,
      label: label,
      role: role,
      action: actionText
    });
  }

  /**
   * 執行夜晚行動轉移 (Night Priority State Machine)
   * @param {function} onSceneChange - 轉移畫面的 UI 回呼
   * @param {function} onNightRoleWake - 當前角色睜眼的操作回呼
   * @param {function} onNightFinished - 夜晚全部結束，天亮的 UI 回呼
   */
  nextNightPhase(onSceneChange, onNightRoleWake, onNightFinished) {
    this.currentNightIndex++;

    if (this.currentNightIndex >= this.nightOrder.length) {
      // 所有角色都醒過來一遍了！夜晚結束，天亮了！
      onNightFinished();
      return;
    }

    const currentRole = this.nightOrder[this.currentNightIndex];
    console.log(`[Night Machine] Priority ${currentRole.priority}: ${currentRole.name}`);

    // 本夜晚階段已確認玩家 ID 集合
    this.nightConfirmedPlayerIds = new Set();

    // 檢查這個角色是否真的在場上玩家的手中
    const isInPlay = this.players.some(p => p.initialRole === currentRole.id);
    const activePlayer = this.players.find(p => p.initialRole === currentRole.id);
    const isRealPlayer = isInPlay && activePlayer && !activePlayer.isAI;

    // 是否有真人玩家（本機或遠端）控制此角色
    const isRealPlayerInPlay = isInPlay && activePlayer && !activePlayer.isAI;

    // 定義本夜晚行動結束的閉眼並前進的回呼
    const proceedToNext = () => {
      this.nextNightPhase(onSceneChange, onNightRoleWake, onNightFinished);
    };

    // 保存回呼給全域調用，支援多重真人角色（如雙狼/雙守墓人）全員相認確認後再前進
    this.finishActiveNightAction = (confirmedPlayerId) => {
      if (confirmedPlayerId) {
        this.nightConfirmedPlayerIds.add(confirmedPlayerId);
      }

      // 取得當前角色在場上的所有真人玩家（本機 + 遠端）
      const activeRealPlayers = this.players.filter(p => p.initialRole === currentRole.id && !p.isAI);
      
      // 若還有真人玩家未確認，則 Host 繼續在遮罩後安靜等待，不推進
      const allConfirmed = activeRealPlayers.every(p => this.nightConfirmedPlayerIds.has(p.id));
      if (activeRealPlayers.length > 0 && !allConfirmed) {
        console.log(`[Night Machine] ${currentRole.name} action: ${this.nightConfirmedPlayerIds.size}/${activeRealPlayers.length} players confirmed. Waiting...`);
        return;
      }

      // 所有人皆確認，播放閉眼語音，並在 300ms 後直接推進至下一階段（不被語音播畢阻塞）
      const sleepText = `${currentRole.name}，請閉眼。`;
      tts.speak(sleepText); // 異步背景播放
      setTimeout(() => {
        proceedToNext();
      }, 300);
    };

    // 觸發 TTS 語音旁白引導
    tts.speakNightPhase(currentRole, isInPlay, isRealPlayer, () => {
      // 睜眼回呼 (若為在場玩家且非 AI，解開閉眼大遮罩，允許操作)
      if (isRealPlayer) {
        onNightRoleWake(currentRole, activePlayer, false); // 真人玩家醒來操作
      } else if (isInPlay && activePlayer && activePlayer.isAI) {
        // AI 玩家醒來：由程式自動執行行動
        AIEngine.executeNightAction(activePlayer, this.players, this.centerCards);
        onNightRoleWake(currentRole, activePlayer, true); // AI 玩家，純展示
        
        // AI 醒來給 800ms 展示時間後自動閉眼進入下一階段
        setTimeout(() => {
          this.finishActiveNightAction();
        }, 800);
      } else {
        // 該角色不在場上 (在底牌中)，或是這是一個遠端真人玩家控制的角色
        onNightRoleWake(currentRole, null, true);
        
        // 關鍵：如果這是一個遠端真人玩家控制的角色，Host 必須在後台安靜等待，絕不能啟動 setTimeout 自動跳過！
        if (isRealPlayerInPlay) {
          console.log(`[Night Machine] Waiting for remote player ${activePlayer.name} to confirm ${currentRole.name} action...`);
        } else {
          // 對於不在場角色（在底牌中），為防範玩家猜出身份分佈，模擬 10 秒等待時間以維護面玩隱蔽性
          const delay = 10000;
          setTimeout(() => {
            this.finishActiveNightAction();
          }, delay);
        }
      }
    });
  }

  /**
   * 結算最終勝負
   */
  judgeWinner() {
    // 1. 收集所有人投票結果，得票最高者死
    const voteCounts = {};
    this.players.forEach(p => {
      if (p.voteFor) {
        voteCounts[p.voteFor] = (voteCounts[p.voteFor] || 0) + 1;
      }
    });

    // 找出最高票數
    let maxVotes = 0;
    Object.keys(voteCounts).forEach(id => {
      if (voteCounts[id] > maxVotes) {
        maxVotes = voteCounts[id];
      }
    });

    // 找出所有得最高票的選項
    let maxVoteTargets = [];
    if (maxVotes > 0) {
      maxVoteTargets = Object.keys(voteCounts).filter(id => voteCounts[id] === maxVotes);
    }

    let deadPlayers = [];
    let noWerewolfVotedWinner = false; // 是否成功投出「場上無狼人」

    if (maxVotes > 1) {
      // 如果唯一的最高票是 "no_werewolves"
      if (maxVoteTargets.length === 1 && maxVoteTargets[0] === 'no_werewolves') {
        noWerewolfVotedWinner = true;
      } else {
        // 最高票有玩家（平手時這些玩家均死亡，排除 "no_werewolves"）
        const deadPlayerIds = maxVoteTargets.filter(id => id !== 'no_werewolves');
        deadPlayers = this.players.filter(p => deadPlayerIds.includes(p.id));
      }
    }

    // 2. 處理「獵人死亡開槍連鎖反應」
    const hunterDead = deadPlayers.find(p => p.currentCard === 'hunter');
    if (hunterDead && hunterDead.voteFor && hunterDead.voteFor !== 'no_werewolves') {
      const hunterTarget = this.players.find(p => p.id === hunterDead.voteFor);
      if (hunterTarget && !deadPlayers.some(p => p.id === hunterTarget.id)) {
        deadPlayers.push(hunterTarget); // 獵人開槍帶走投票對象
        console.log(`Hunter ${hunterDead.name} died and shot ${hunterTarget.name}!`);
      }
    }

    const deadRoles = deadPlayers.map(p => p.currentCard);
    const hasWerewolfDead = deadRoles.includes('werewolf');
    const hasTannerDead = deadRoles.includes('tanner');

    // 檢查場上實際是否有狼人
    const isWerewolfInPlay = this.players.some(p => p.currentCard === 'werewolf');

    let winningTeam = '';
    let summaryText = '';

    // 勝負判定邏輯
    if (hasTannerDead) {
      // 皮皮鬼死亡 -> 皮皮鬼單獨獲勝！
      winningTeam = '皮皮鬼';
      summaryText = `最厭世的「皮皮鬼」成功被大家投死了！他單獨獲得遊戲勝利！`;
    } else if (noWerewolfVotedWinner) {
      // 成功投出「沒有狼人」
      if (!isWerewolfInPlay) {
        winningTeam = '村民陣營';
        summaryText = `大家成功投票判定「場上沒有狼人」（全在底牌中），村民大獲全勝！`;
      } else {
        winningTeam = '狼人陣營';
        summaryText = `大家投票判定「場上沒有狼人」，但實際上場上有狼人隱藏！狼人陣營大獲全勝！`;
      }
    } else if (isWerewolfInPlay) {
      // 場上有狼人
      if (hasWerewolfDead) {
        winningTeam = '村民陣營';
        summaryText = `死者中包含狼人（${deadPlayers.filter(p => p.currentCard === 'werewolf').map(p => p.name).join(', ')}），村民成功保衛家園！`;
      } else {
        winningTeam = '狼人陣營';
        summaryText = `死者中沒有任何一隻狼人（死者：${deadPlayers.length > 0 ? deadPlayers.map(p => p.name).join(', ') : '無人死亡'}），狼人成功潛伏！`;
      }
    } else {
      // 場上無狼人（無狼局，且沒有人是唯一最高票投「無狼人」）
      if (deadPlayers.length === 0) {
        winningTeam = '村民陣營';
        summaryText = `場上其實沒有狼人（全在底牌中），大家默契投票無人死亡，村民大獲全勝！`;
      } else {
        winningTeam = '無人獲勝';
        summaryText = `場上其實沒有狼人，但大家卻投死了無辜村民 ${deadPlayers.map(p => p.name).join(', ')}，全盤皆輸！`;
      }
    }

    return {
      deadPlayers,
      winningTeam,
      summaryText,
      voteCounts
    };
  }
}
