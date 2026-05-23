/* ==========================================================================
   《一夜終極狼人殺》- 網頁 TTS 語音旁白控制器 (js/tts.js)
   ========================================================================== */

class TTSController {
  constructor() {
    this.enabled = true;
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.rate = 0.85; // 稍微放慢，營造神祕感
    this.pitch = 0.9; // 稍微低沉

    // 初始化語音引擎
    this.initVoices();
    if (this.synth && this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = () => this.initVoices();
    }
  }

  initVoices() {
    if (!this.synth) return;
    const voices = this.synth.getVoices();
    // 優先挑選中文語音 (台灣或香港的中文女聲，效果通常最自然)
    this.voice = voices.find(v => v.lang.includes('zh-TW')) || 
                 voices.find(v => v.lang.includes('zh-HK')) || 
                 voices.find(v => v.lang.includes('zh-CN')) || 
                 voices[0];
  }

  toggle(forceState = null) {
    this.enabled = forceState !== null ? forceState : !this.enabled;
    if (!this.enabled) {
      this.cancel();
    }
    return this.enabled;
  }

  cancel() {
    if (this.synth) {
      this.synth.cancel();
    }
  }

  /**
   * 播放語音
   * @param {string} text - 朗讀文字
   * @param {function} onEnd - 朗讀完畢回呼
   */
  speak(text, onEnd = null) {
    this.cancel();
    
    if (!this.enabled || !this.synth) {
      // 若語音關閉，使用模擬延遲代表朗讀時間
      const delay = Math.max(2000, text.length * 150);
      setTimeout(() => {
        if (onEnd) onEnd();
      }, delay);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) {
      utterance.voice = this.voice;
    }
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    
    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      console.warn("TTS speak error:", e);
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  /**
   * 播放夜晚角色的行動指示
   * @param {object} role - 角色定義
   * @param {boolean} isInPlay - 角色是否真的在場上玩家中
   * @param {function} onActionStart - 睜眼並允許操作的回呼
   * @param {function} onActionEnd - 行動結束、閉眼並轉向下一階段的回呼
   */
  speakNightPhase(role, isInPlay, onActionStart, onActionEnd) {
    const roleName = role.name;
    const wakeText = `${roleName}，請睜眼。`;
    let instructionText = "";

    // 根據角色提供語音引導
    if (role.id === 'werewolf') {
      instructionText = "狼人請互相確認隊友。如果場上只有一隻狼人，你可以查看一張桌子中央的底牌。";
    } else if (role.id === 'minion') {
      instructionText = "爪牙請睜眼，確認誰是狼人。";
    } else if (role.id === 'mason') {
      instructionText = "守墓人請睜眼，確認你的同伴。";
    } else if (role.id === 'seer') {
      instructionText = "預言家，請選擇查看一位玩家的牌，或者查看兩張底牌。";
    } else if (role.id === 'robber') {
      instructionText = "強盜，請選擇一位玩家交換卡牌，並查看你的新身份。";
    } else if (role.id === 'troublemaker') {
      instructionText = "搗蛋鬼，請選擇其他兩位玩家，將他們的卡牌互換。";
    } else if (role.id === 'drunk') {
      instructionText = "酒鬼，請選擇一張桌上的底牌與你的卡牌交換。";
    } else if (role.id === 'insomniac') {
      instructionText = "失眠者，請查看你面前的牌，確認你目前的身份。";
    }

    const sleepText = `${roleName}，請閉眼。`;

    // 1. 播報「XX請睜眼...行動說明」
    this.speak(`${wakeText} ${instructionText}`, () => {
      // 2. 觸發前台操作顯示
      if (onActionStart) {
        onActionStart();
      }

      // 3. 設定等待時間供玩家操作或模擬空檔
      // 如果角色不在場上，則系統模擬隨機 5-9 秒的空檔
      const delayTime = isInPlay ? 12000 : (Math.random() * 4000 + 5000); // 在場玩家給 12 秒操作，不在場模擬 5-9 秒

      setTimeout(() => {
        // 4. 播報「XX請閉眼」
        this.speak(sleepText, () => {
          // 隨便延遲 1 秒，轉向下一位
          setTimeout(() => {
            if (onActionEnd) onActionEnd();
          }, 1000);
        });
      }, delayTime);
    });
  }
}

export const tts = new TTSController();
