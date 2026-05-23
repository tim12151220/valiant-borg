/* ==========================================================================
   《一夜終極狼人殺》- 角色與夜晚行動順序定義 (js/roles.js)
   ========================================================================== */

export const TEAMS = {
  WEREWOLF: 'werewolf',
  VILLAGER: 'villager',
  TANNER: 'tanner' // 皮皮鬼單獨陣營
};

export const ROLES = {
  WEREWOLF: {
    id: 'werewolf',
    name: '狼人',
    team: TEAMS.WEREWOLF,
    priority: 1,
    icon: '🐺',
    img: 'assets/werewolf.png',
    bgGlow: 'var(--glow-rose)',
    description: '夜晚睜眼互相確認隊友。若場上只有一隻狼人，可查看一張底牌。'
  },
  MINION: {
    id: 'minion',
    name: '爪牙',
    team: TEAMS.WEREWOLF,
    priority: 2,
    icon: '👁️‍🗨️',
    img: 'assets/card_back.png', // 備用
    bgGlow: 'var(--glow-orange)',
    description: '夜晚睜眼查看誰是狼人。如果爪牙死而狼人沒死，狼人依然獲勝。'
  },
  MASON: {
    id: 'mason',
    name: '守墓人',
    team: TEAMS.VILLAGER,
    priority: 3,
    icon: '🛡️',
    img: 'assets/card_back.png',
    bgGlow: 'var(--glow-blue)',
    description: '與另一位守墓人同時睜眼，互相確認身份。'
  },
  SEER: {
    id: 'seer',
    name: '預言家',
    team: TEAMS.VILLAGER,
    priority: 4,
    icon: '🔮',
    img: 'assets/seer.png',
    bgGlow: 'var(--glow-cyan)',
    description: '可以選擇查看一位其他玩家的牌，或者查看兩張桌子中央的底牌。'
  },
  ROBBER: {
    id: 'robber',
    name: '強盜',
    team: TEAMS.VILLAGER,
    priority: 5,
    icon: '🗡️',
    img: 'assets/robber.png',
    bgGlow: 'var(--glow-green)',
    description: '強行將自己的牌與一位玩家交換，並且可以查看自己拿到的新身份。'
  },
  TROUBLEMAKER: {
    id: 'troublemaker',
    name: '搗蛋鬼',
    team: TEAMS.VILLAGER,
    priority: 6,
    icon: '⚡',
    img: 'assets/troublemaker.png',
    bgGlow: 'var(--glow-purple)',
    description: '偷偷將其他兩位玩家的牌互換，自己不能看牌的內容。'
  },
  DRUNK: {
    id: 'drunk',
    name: '酒鬼',
    team: TEAMS.VILLAGER,
    priority: 7,
    icon: '🍺',
    img: 'assets/card_back.png',
    bgGlow: 'var(--glow-gold)',
    description: '強行把自己的牌與一張底牌交換，但自己不能看換到了什麼。'
  },
  INSOMNIAC: {
    id: 'insomniac',
    name: '失眠者',
    team: TEAMS.VILLAGER,
    priority: 8,
    icon: '⏰',
    img: 'assets/card_back.png',
    bgGlow: 'var(--glow-ruby)',
    description: '在夜晚的最後醒來，確認自己目前的卡牌是否被換走。'
  },
  VILLAGER: {
    id: 'villager',
    name: '村民',
    team: TEAMS.VILLAGER,
    priority: 0, // 無夜晚行動
    icon: '🧑‍🌾',
    img: 'assets/card_back.png',
    bgGlow: 'rgba(255, 255, 255, 0.2)',
    description: '無夜晚行動的純村民，增加推理與扮演難度。'
  },
  HUNTER: {
    id: 'hunter',
    name: '獵人',
    team: TEAMS.VILLAGER,
    priority: 0, // 無夜晚行動
    icon: '🏹',
    img: 'assets/card_back.png',
    bgGlow: 'var(--glow-orange)',
    description: '無夜晚行動。被投死時，他投票的人也會跟著一同死亡。'
  },
  TANNER: {
    id: 'tanner',
    name: '皮皮鬼',
    team: TEAMS.TANNER,
    priority: 0, // 無夜晚行動
    icon: '🤡',
    img: 'assets/card_back.png',
    bgGlow: 'rgba(255, 255, 255, 0.4)',
    description: '無夜晚行動。最厭世的人，唯一目標是讓自己被投死。被投死時單獨獲勝！'
  }
};

/**
 * 取得需要叫醒的角色夜晚優先級順序
 * 排除 priority 為 0 的白板角色
 */
export function getNightOrder(activeRoles) {
  const uniqueRoles = Array.from(new Set(activeRoles));
  return uniqueRoles
    .map(roleId => {
      const roleKey = Object.keys(ROLES).find(k => ROLES[k].id === roleId);
      return ROLES[roleKey];
    })
    .filter(role => role.priority > 0)
    .sort((a, b) => a.priority - b.priority);
}
