/* ==========================================================================
   《一夜終極狼人殺》- 智慧 AI 決策與心機發言引擎 (js/ai.js)
   ========================================================================== */

import { ROLES, TEAMS } from './roles.js';

export class AIEngine {
  /**
   * 模擬 AI 在夜晚的行動決策
   * @param {object} aiPlayer - AI 玩家對象
   * @param {array} allPlayers - 場上所有玩家
   * @param {array} centerCards - 桌面中央底牌
   */
  static executeNightAction(aiPlayer, allPlayers, centerCards) {
    const roleId = aiPlayer.initialRole;
    aiPlayer.aiKnowledge = {
      initialRole: roleId,
      seenCards: [], // { targetType: 'player'|'center', targetId: string/number, role: string }
      swapped: [],   // 記錄交換行為
      seenSelfFinal: null
    };

    const otherPlayers = allPlayers.filter(p => p.id !== aiPlayer.id);

    if (roleId === 'werewolf') {
      // 狼人行動
      const teamWerewolves = allPlayers.filter(p => p.currentCard === 'werewolf');
      if (teamWerewolves.length === 1) {
        // 單狼：查看一張底牌
        const randIdx = Math.floor(Math.random() * 3);
        aiPlayer.aiKnowledge.seenCards.push({
          targetType: 'center',
          targetId: randIdx,
          role: centerCards[randIdx]
        });
      }
    } else if (roleId === 'minion') {
      // 爪牙行動：看到誰是狼人
      allPlayers.forEach(p => {
        if (p.currentCard === 'werewolf' && p.id !== aiPlayer.id) {
          aiPlayer.aiKnowledge.seenCards.push({
            targetType: 'player',
            targetId: p.id,
            role: 'werewolf'
          });
        }
      });
    } else if (roleId === 'mason') {
      // 守墓人：看到另一個守墓人
      allPlayers.forEach(p => {
        if (p.currentCard === 'mason' && p.id !== aiPlayer.id) {
          aiPlayer.aiKnowledge.seenCards.push({
            targetType: 'player',
            targetId: p.id,
            role: 'mason'
          });
        }
      });
    } else if (roleId === 'seer') {
      // 預言家行動：50% 看一個玩家，50% 看兩張底牌
      if (Math.random() > 0.5 && otherPlayers.length > 0) {
        const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        aiPlayer.aiKnowledge.seenCards.push({
          targetType: 'player',
          targetId: target.id,
          role: target.currentCard
        });
      } else {
        const indices = [0, 1, 2].sort(() => 0.5 - Math.random()).slice(0, 2);
        indices.forEach(idx => {
          aiPlayer.aiKnowledge.seenCards.push({
            targetType: 'center',
            targetId: idx,
            role: centerCards[idx]
          });
        });
      }
    } else if (roleId === 'robber') {
      // 強盜行動：必偷一個玩家並看新牌
      if (otherPlayers.length > 0) {
        const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        const temp = aiPlayer.currentCard;
        aiPlayer.currentCard = target.currentCard;
        target.currentCard = temp;

        aiPlayer.aiKnowledge.seenSelfFinal = aiPlayer.currentCard;
        aiPlayer.aiKnowledge.swapped.push({
          type: 'robber',
          player1: aiPlayer.id,
          player2: target.id
        });
        aiPlayer.aiKnowledge.seenCards.push({
          targetType: 'player',
          targetId: target.id,
          role: temp // 他留給對方的牌（Robber）
        });
      }
    } else if (roleId === 'troublemaker') {
      // 搗蛋鬼行動：隨機交換其他兩人的牌
      if (otherPlayers.length >= 2) {
        const shuffled = [...otherPlayers].sort(() => 0.5 - Math.random());
        const p1 = shuffled[0];
        const p2 = shuffled[1];
        const temp = p1.currentCard;
        p1.currentCard = p2.currentCard;
        p2.currentCard = temp;

        aiPlayer.aiKnowledge.swapped.push({
          type: 'troublemaker',
          player1: p1.id,
          player2: p2.id
        });
      }
    } else if (roleId === 'drunk') {
      // 酒鬼行動：隨機跟一張底牌換
      const randIdx = Math.floor(Math.random() * 3);
      const temp = aiPlayer.currentCard;
      aiPlayer.currentCard = centerCards[randIdx];
      centerCards[randIdx] = temp;

      aiPlayer.aiKnowledge.swapped.push({
        type: 'drunk',
        player: aiPlayer.id,
        centerIndex: randIdx
      });
    } else if (roleId === 'insomniac') {
      // 失眠者行動：看自己的牌
      aiPlayer.aiKnowledge.seenSelfFinal = aiPlayer.currentCard;
    }
  }

  /**
   * 根據 AI 的當前手牌、性格和知識庫，生成白天的發言內容
   * @param {object} aiPlayer - AI 玩家對象
   * @param {array} allPlayers - 場上所有玩家
   * @param {array} activeRoles - 本局遊戲中的所有角色卡池
   */
  static generateSpeech(aiPlayer, allPlayers, activeRoles) {
    const currentRole = aiPlayer.currentCard; // 最終的真實身份
    const initialRole = aiPlayer.initialRole; // 初始身份
    const knowledge = aiPlayer.aiKnowledge || { initialRole, seenCards: [], swapped: [] };
    const name = aiPlayer.name;

    // 取得其他玩家名單
    const otherPlayers = allPlayers.filter(p => p.id !== aiPlayer.id);

    // AI 性格加成發言語氣
    const p = aiPlayer.aiPersonality;
    const suffix = p === 'cunning' ? '哼哼，我總覺得事情沒那麼簡單。' : 
                   p === 'chaotic' ? '哈哈！今天大家就一起亂成一團吧！' :
                   p === 'quiet' ? '...呃，我隨便，大家看著辦。' : '我句句屬實。';

    // 1. 如果最終身份是狼人 (或是爪牙) -> 必須假跳身分撒謊
    if (currentRole === 'werewolf' || currentRole === 'minion') {
      // 選擇一個「安全的身份」假跳，優先跳「村民」、「守墓人」、「預言家」
      const claimableRoles = ['villager', 'mason', 'seer', 'robber'];
      const chosenFakeRole = claimableRoles[Math.floor(Math.random() * claimableRoles.length)];

      if (chosenFakeRole === 'villager') {
        aiPlayer.publicClaim = 'villager';
        return `我是老實的村民，昨晚我睡得很沉，什麼事都沒做。但我剛才看 ${otherPlayers[0].name} 的表情有點心虛，該不會是狼吧？ ${suffix}`;
      }
      
      if (chosenFakeRole === 'mason') {
        // 尋找另一個守墓人，或是胡謅一個
        aiPlayer.publicClaim = 'mason';
        const otherMason = otherPlayers.find(p => p.currentCard === 'mason');
        const masonTarget = otherMason ? otherMason.name : otherPlayers[Math.floor(Math.random() * otherPlayers.length)].name;
        return `我是守墓人，昨晚我和 ${masonTarget} 確認過眼神，我們是同伴。場上絕對有其他狼，大家小心！`;
      }

      if (chosenFakeRole === 'seer') {
        // 假冒預言家，胡扯看過某些人是村民，或是看過底牌
        aiPlayer.publicClaim = 'seer';
        const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        return `我是預言家！昨晚我看了 ${target.name} 的牌，他是一張「村民」！他絕對是好人，我們可以信任他。 ${suffix}`;
      }

      if (chosenFakeRole === 'robber') {
        aiPlayer.publicClaim = 'robber';
        const target = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
        return `昨晚我是強盜，我搶了 ${target.name} 的牌，一看是一張「村民」！所以我現在是村民，他是強盜，大家別投錯人囉。`;
      }
    }

    // 2. 如果最終身份是皮皮鬼 (Tanner) -> 目標是讓自己被投死，因此要故意露出狼腳或行為異常！
    if (currentRole === 'tanner') {
      aiPlayer.publicClaim = Math.random() > 0.5 ? 'seer' : 'robber';
      const behaviors = [
        `（眼神閃爍）我...我是預言家，我昨晚看了底牌，底牌有兩張狼人！...啊，不對，我是說，底牌有兩張村民。大家投我吧，投我最安全！`,
        `我是強盜！我昨晚換了 ${otherPlayers[0].name} 的牌，他現在是強盜，我變成了狼人！...不對，我變成了村民！大家快投死我，我是壞人！`,
        `不要問我，我是村民。但我昨晚聽到我旁邊有很大的動靜，肯定是我自己動的...等一下，我到底在說什麼。大家投我，我就是狼！`
      ];
      return behaviors[Math.floor(Math.random() * behaviors.length)];
    }

    // 3. 正常村民陣營發言 (Honest Villagers) -> 誠實講述自己的知識
    if (initialRole === 'villager') {
      aiPlayer.publicClaim = 'villager';
      return `我是村民，夜晚完全沒行動。希望預言家或搗蛋鬼出來帶領大家，我們一定要把狼人投死！`;
    }

    if (initialRole === 'hunter') {
      aiPlayer.publicClaim = 'hunter';
      return `我是獵人，夜晚沒事做。不過如果大家懷疑我把我投死，我會拉走我投票的那個人，壞人自己看著辦！`;
    }

    if (initialRole === 'mason') {
      aiPlayer.publicClaim = 'mason';
      const masonPartner = knowledge.seenCards.find(c => c.role === 'mason');
      if (masonPartner) {
        const partner = allPlayers.find(p => p.id === masonPartner.targetId);
        return `我是守墓人！我的同伴是 ${partner.name}，我們互相確認過，我們兩個保證是好人陣營！`;
      } else {
        return `我是守墓人，但我昨晚睜眼沒看到另一個同伴，看來另一張守墓人在底牌。場上的局勢有點危險。`;
      }
    }

    if (initialRole === 'seer') {
      aiPlayer.publicClaim = 'seer';
      const seenPlayer = knowledge.seenCards.find(c => c.targetType === 'player');
      const seenCenter = knowledge.seenCards.filter(c => c.targetType === 'center');
      
      if (seenPlayer) {
        const target = allPlayers.find(p => p.id === seenPlayer.targetId);
        const chineseRole = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === seenPlayer.role)].name;
        return `我是真正的預言家！昨晚我看了 ${target.name} 的初始牌，他居然是一張「${chineseRole}」！大家可以根據這點來推理。`;
      } else if (seenCenter.length >= 2) {
        const c1 = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === seenCenter[0].role)].name;
        const c2 = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === seenCenter[1].role)].name;
        return `我是預言家，昨晚我看了兩張底牌，分別是「${c1}」和「${c2}」。這代表這兩個身份不在場上，大家可以排除了。`;
      }
      return `我是預言家，但我昨晚睡過頭了忘記看牌...開玩笑的，我是好人。`;
    }

    if (initialRole === 'robber') {
      const robAction = knowledge.swapped[0];
      if (robAction) {
        const target = allPlayers.find(p => p.id === robAction.player2);
        const finalRole = knowledge.seenSelfFinal;
        const finalRoleName = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === finalRole)].name;
        
        if (finalRole === 'werewolf') {
          // 強盜偷到狼！這時 AI 強盜已經變成新狼人了，因此要撒謊！
          aiPlayer.publicClaim = 'villager';
          return `我是強盜，昨晚我換了 ${target.name} 的牌，發現他是一張「村民」！所以我現在是村民了，他是強盜，大家別投我。`;
        } else {
          // 偷到其他好人，實話實說
          aiPlayer.publicClaim = 'robber';
          return `我是強盜！我昨晚搶了 ${target.name} 的牌，搶到了「${finalRoleName}」！所以我現在擁有「${finalRoleName}」的能力，而他現在是強盜！`;
        }
      }
    }

    if (initialRole === 'troublemaker') {
      aiPlayer.publicClaim = 'troublemaker';
      const swapAction = knowledge.swapped[0];
      if (swapAction) {
        const p1 = allPlayers.find(p => p.id === swapAction.player1);
        const p2 = allPlayers.find(p => p.id === swapAction.player2);
        return `我是搗蛋鬼！昨晚我把 ${p1.name} 和 ${p2.name} 的牌進行了互換！你們兩個人的身份已經跟昨晚不一樣了，快看看你們的發言對不對得上！`;
      }
    }

    if (initialRole === 'drunk') {
      aiPlayer.publicClaim = 'drunk';
      const drunkSwap = knowledge.swapped[0];
      return `我是酒鬼！昨晚我隨機換了桌上第 ${drunkSwap.centerIndex + 1} 張底牌，所以我現在根本不知道自己成了什麼，但我初始絕對是好人，大家不要投我！`;
    }

    if (initialRole === 'insomniac') {
      aiPlayer.publicClaim = 'insomniac';
      const finalRole = knowledge.seenSelfFinal;
      const finalRoleName = ROLES[Object.keys(ROLES).find(k => ROLES[k].id === finalRole)].name;
      if (finalRole === initialRole) {
        return `我是失眠者。我昨晚醒來確認過，我的牌沒有動過，我依然是「失眠者」！這代表沒有強盜或搗蛋鬼對我動手。`;
      } else {
        return `我是失眠者。但我昨晚最後醒來發現我的牌被換走了！我現在的新身份居然是「${finalRoleName}」！昨晚絕對有搗蛋鬼或強盜對我下手了！`;
      }
    }

    return `我是村民，我相信好人陣營一定會獲勝！`;
  }
}
