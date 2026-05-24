/* ==========================================================================
   《一夜終極狼人殺》- WebRTC P2P 房間連線邏輯 (js/webrtc.js)
   ========================================================================== */

export class P2PManager {
  constructor(onMessageCallback, onStatusCallback) {
    this.peer = null;
    this.conn = null; // 僅示範單一雙向連線 (可擴展為多連線，但為 Terse 主要支援 1v1 或簡單傳閱連線)
    this.connections = []; // 存放所有連線的 Peer
    this.isHost = false;
    this.onMessage = onMessageCallback;
    this.onStatus = onStatusCallback;
    this.roomId = null;
  }

  /**
   * 動態載入 PeerJS 函式庫
   */
  async loadPeerJS() {
    if (window.Peer) return true;
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js';
      script.onload = () => {
        console.log("PeerJS loaded successfully.");
        resolve(true);
      };
      script.onerror = () => {
        reject(new Error("Failed to load PeerJS library."));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * 初始化 Host 房間
   */
  async createRoom() {
    try {
      await this.loadPeerJS();
      this.isHost = true;
      this.logStatus("正在向訊號伺服器請求房間 ID...");

      // 建立 Peer
      this.peer = new window.Peer();

      this.peer.on('open', (id) => {
        this.roomId = id;
        this.logStatus(`房間創建成功！房號：${id}`);
        if (this.onStatus) this.onStatus('created', id);
      });

      this.peer.on('connection', (conn) => {
        this.logStatus(`玩家 ${conn.peer.substring(0, 6)} 正在連線...`);
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error("PeerJS error:", err);
        this.logStatus(`錯誤：${err.type || '連線失敗'}`);
      });

    } catch (e) {
      this.logStatus(`無法建立房間：${e.message}`);
    }
  }

  /**
   * 加入已存在的房間
   * @param {string} targetRoomId - 目標房間 ID
   * @param {string} myName - 玩家自訂稱呼
   */
  async joinRoom(targetRoomId, myName) {
    try {
      await this.loadPeerJS();
      this.isHost = false;
      this.playerName = myName || '遠端玩家';
      this.logStatus("正在嘗試連線到房間...");

      this.peer = new window.Peer();

      this.peer.on('open', (id) => {
        this.logStatus(`已連接訊號伺服器，正撥號給：${targetRoomId}`);
        const conn = this.peer.connect(targetRoomId);
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        console.error("PeerJS error:", err);
        this.logStatus(`連線錯誤：${err.message}`);
      });

    } catch (e) {
      this.logStatus(`無法加入房間：${e.message}`);
    }
  }

  setupConnection(conn) {
    this.conn = conn;
    this.connections.push(conn);

    conn.on('open', () => {
      this.logStatus(`與玩家 ${conn.peer.substring(0, 6)} 連線成功！可以開始同步。`);
      if (this.onStatus) this.onStatus('connected', conn.peer);
      
      // 連線成功時，如果是 Client，發送加入訊號
      if (!this.isHost) {
        this.send({ type: 'JOIN_LOBBY', playerName: this.playerName });
      }
    });

    conn.on('data', (data) => {
      console.log("P2P Data Received:", data);
      if (this.onMessage) {
        this.onMessage(data, conn);
      }
    });

    conn.on('close', () => {
      this.logStatus("連線已中斷。");
      if (this.onStatus) this.onStatus('disconnected', conn.peer, conn);
      this.connections = this.connections.filter(c => c.peer !== conn.peer);
    });
  }

  /**
   * 廣播或發送資料給所有連接者
   * @param {object} payload - 發送的 JSON 資料
   */
  send(payload) {
    if (this.connections.length > 0) {
      this.connections.forEach(conn => {
        if (conn.open) {
          conn.send(payload);
        }
      });
    } else if (this.conn && this.conn.open) {
      this.conn.send(payload);
    } else {
      console.warn("No active P2P connection to send data.");
    }
  }

  logStatus(msg) {
    console.log("[P2P Status]", msg);
    const logEl = document.getElementById('p2p-status');
    if (logEl) {
      logEl.innerText = msg;
    }
  }

  disconnect() {
    if (this.peer) {
      this.peer.destroy();
    }
    this.connections = [];
    this.conn = null;
  }
}
