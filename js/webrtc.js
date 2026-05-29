/* ==========================================================================
   《一夜終極狼人殺》- WebRTC P2P 房間連線邏輯 (js/webrtc.js)
   ========================================================================== */

const ICE_CONFIG = {
  config: {
    iceServers: [
      // 穩定的全球 STUN 伺服器群
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      // 免費且高穿透力的公共 TURN (Relay) 中繼伺服器，解決對稱型 NAT 與學校/公司嚴格防火牆限制
      {
        urls: [
          'turn:relay.metered.ca:80',
          'turn:relay.metered.ca:443?transport=tcp'
        ],
        username: 'metered',
        credential: 'metered'
      }
    ]
  }
};

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
    const cdns = [
      'https://cdn.jsdelivr.net/npm/peerjs@1.5.2/dist/peerjs.min.js',
      'https://cdnjs.cloudflare.com/ajax/libs/peerjs/1.5.2/peerjs.min.js',
      'https://unpkg.com/peerjs@1.5.2/dist/peerjs.min.js'
    ];

    for (let i = 0; i < cdns.length; i++) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = cdns[i];
          script.onload = () => resolve(true);
          script.onerror = () => reject(new Error(`Failed to load CDN: ${cdns[i]}`));
          document.head.appendChild(script);
        });
        console.log(`PeerJS loaded successfully from CDN: ${cdns[i]}`);
        return true;
      } catch (e) {
        console.warn(e.message);
      }
    }
    throw new Error("所有 PeerJS CDN 均載入失敗，請檢查網路連線！");
  }

  /**
   * 初始化 Host 房間
   */
  async createRoom() {
    try {
      await this.loadPeerJS();
      this.isHost = true;
      this.logStatus("正在向訊號伺服器請求房間 ID...");

      // 建立 Peer (傳入高穿透性 ICE 伺服器配置與跨國高延遲優化)
      this.peer = new window.Peer({
        ...ICE_CONFIG,
        pingInterval: 5000 // 縮短心跳間隔以維持高延遲跨國連線的活躍
      });

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
        let tip = `錯誤：${err.type || '建立房間失敗'}`;
        if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
          tip = "⚠️ 信令伺服器連線超時/失敗！請檢查您的網路，或嘗試切換手機 4G/5G 熱點，並重新整理網頁再試。";
        }
        this.logStatus(tip);
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

      // 建立 Peer (傳入高穿透性 ICE 伺服器配置與跨國高延遲優化)
      this.peer = new window.Peer({
        ...ICE_CONFIG,
        pingInterval: 5000 // 縮短心跳間隔以維持高延遲跨國連線的活躍
      });

      let connectionTimer = null;

      // 重要：Client 也必須監聽進來的連線請求！當房主發起「反向呼叫」時，Client 才能正確接收並建立 P2P 通道
      this.peer.on('connection', (conn) => {
        this.logStatus(`接收到房主的反向呼叫連線！正在接聽...`);
        if (connectionTimer) clearTimeout(connectionTimer);
        this.setupConnection(conn);
      });

      this.peer.on('open', (id) => {
        this.logStatus(`已連接信令伺服器。您的臨時 Peer ID：${id}。正在撥號給房主：${targetRoomId}...`);
        if (this.onStatus) this.onStatus('client-peer-id', id);

        // 使用高相容性的 JSON 序列化發起 P2P 連線，防止 Safari/行動端 Binary 限制卡死
        const conn = this.peer.connect(targetRoomId, {
          serialization: 'json',
          reliable: true
        });
        this.setupConnection(conn);

        // 啟動 6.5 秒連線超時超貼心提示：防範房主處於對稱型 NAT 嚴格防火牆
        connectionTimer = setTimeout(() => {
          if (!conn.open) {
            this.logStatus(`⚠️ 連線超時！對方房主可能處於嚴格對稱防火牆後方。請複製您的臨時 Peer ID【${id}】發給房主，讓房主在大廳主動【反向呼叫】您進行反向打洞！`);
          }
        }, 6500);
      });

      this.peer.on('error', (err) => {
        if (connectionTimer) clearTimeout(connectionTimer);
        console.error("PeerJS error:", err);
        let tip = `連線錯誤：${err.message || '連線失敗'}`;
        if (err.type === 'network' || err.type === 'server-error' || err.type === 'socket-error') {
          tip = "⚠️ 信令伺服器連線超時！請檢查網路，嘗試切換手機 4G/5G 網路，並重新整理網頁再試。";
        } else if (err.type === 'peer-unavailable') {
          tip = "⚠️ 找不到該房間 ID！請確認您的房號是否輸入正確（大小寫需完全一致）。";
        } else if (err.type === 'webrtc') {
          tip = "⚠️ P2P 連線建立失敗！可能是雙方皆處於嚴格對稱 NAT 防火牆後方，請嘗試改由另一人創建房間（更換房主）！";
        }
        this.logStatus(tip);
      });

    } catch (e) {
      this.logStatus(`無法加入房間：${e.message}`);
    }
  }

  /**
   * 房主主動反向撥號（反向打洞），繞過對稱 NAT 限制
   * @param {string} targetClientId - 遠端 Client 的臨時 Peer ID
   */
  reverseConnect(targetClientId) {
    if (!this.isHost || !this.peer) {
      this.logStatus("⚠️ 只有房主且在房間創建成功後，才能進行反向呼叫！");
      return;
    }
    this.logStatus(`正在主動反向撥號給 Client【${targetClientId.substring(0, 6)}】...`);
    const conn = this.peer.connect(targetClientId, {
      serialization: 'json',
      reliable: true
    });
    this.setupConnection(conn);
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
