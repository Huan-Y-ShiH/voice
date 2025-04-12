from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
from datetime import datetime
from typing import Dict
import sqlite3
from contextlib import contextmanager

app = FastAPI()

# CORS设置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # 添加你的前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 用户存储
users: Dict[str, str] = {}  # username -> client_id


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.username_to_client: Dict[str, str] = {}

    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        print(f"新连接已接受: {client_id}")  # 添加日志

    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            print(f"连接已断开: {client_id}")  # 添加日志
            # 更新数据库中的client_id
            with get_db() as conn:
                conn.execute('UPDATE users SET client_id = NULL WHERE client_id = ?', (client_id,))
                conn.commit()
            # 清理用户名映射
            for username, cid in list(self.username_to_client.items()):
                if cid == client_id:
                    del self.username_to_client[username]
                    if username in users:
                        del users[username]

    async def send_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)

    def associate_user(self, username: str, client_id: str):
        self.username_to_client[username] = client_id
        users[username] = client_id
        # 更新数据库中的client_id
        with get_db() as conn:
            conn.execute('UPDATE users SET client_id = ? WHERE username = ?', (client_id, username))
            conn.commit()
        print(f"用户关联已更新: {username} -> {client_id}")  # 添加日志


manager = ConnectionManager()


# 修改数据库连接管理器
@contextmanager
def get_db():
    conn = None
    try:
        conn = sqlite3.connect('users.db')
        # 启用外键约束
        conn.execute('PRAGMA foreign_keys = ON')
        yield conn
    except sqlite3.Error as e:
        print(f"数据库连接错误: {e}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            try:
                conn.close()
            except Exception as e:
                print(f"关闭数据库连接错误: {e}")


# 修改注册函数
@app.post("/register")
async def register_user(data: dict):
    try:
        username = data.get("username")
        if not username:
            raise HTTPException(status_code=400, detail="用户名不能为空")
        
        print(f"尝试注册用户: {username}")
        
        # 直接使用 sqlite3.connect 而不是 get_db
        conn = sqlite3.connect('users.db')
        try:
            # 检查用户是否已存在
            cursor = conn.execute('SELECT username FROM users WHERE username = ?', (username,))
            if cursor.fetchone():
                conn.close()
                print(f"用户名 {username} 已存在")
                raise HTTPException(status_code=400, detail="用户名已存在")
            
            # 插入新用户
            conn.execute('INSERT INTO users (username) VALUES (?)', (username,))
            conn.commit()
            conn.close()
            print(f"用户 {username} 注册成功")
            return {"status": "success", "message": "注册成功"}
            
        except Exception as e:
            conn.rollback()
            conn.close()
            print(f"数据库操作错误: {e}")
            raise HTTPException(status_code=500, detail=f"数据库错误: {str(e)}")
            
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"未知错误: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# 修改初始化函数
def init_db():
    print("开始初始化数据库...")
    try:
        with sqlite3.connect('users.db') as conn:
            # 检查表是否存在
            cursor = conn.cursor()
            cursor.execute('''
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name='users'
            ''')
            
            if not cursor.fetchone():
                print("创建 users 表...")
                conn.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    username TEXT PRIMARY KEY,
                    client_id TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                ''')
                conn.commit()
                print("数据库表创建成功")
            else:
                print("users 表已存在")
                
        print("数据库初始化完成")
        
    except Exception as e:
        print(f"数据库初始化错误: {e}")
        raise


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    print(f"新的WebSocket连接请求: {client_id}")
    await manager.connect(websocket, client_id)
    try:
        while True:
            data = await websocket.receive_json()
            print(f"收到WebSocket消息: {data}")
            if data.get("type") == "register":
                username = data.get("username")
                if username:
                    print(f"用户 {username} 注册WebSocket连接")
                    # 先检查用户是否在数据库中
                    with get_db() as conn:
                        cursor = conn.execute('SELECT username FROM users WHERE username = ?', (username,))
                        if cursor.fetchone():
                            manager.associate_user(username, client_id)
                            print(f"当前活跃用户: {users}")
                        else:
                            print(f"用户 {username} 不在数据库中")
    except WebSocketDisconnect:
        print(f"WebSocket连接断开: {client_id}")
        manager.disconnect(client_id)


@app.post("/send-instruction/{username}")
async def send_instruction(username: str, message: dict):
    print(f"尝试发送消息给用户 {username}: {message}")

    # 先从数据库检查用户
    with get_db() as conn:
        cursor = conn.execute('SELECT client_id FROM users WHERE username = ?', (username,))
        result = cursor.fetchone()
        if not result:
            print(f"用户 {username} 在数据库中未找到")
            raise HTTPException(status_code=404, detail="User not found")

        db_client_id = result[0]

    # 检查内存中的状态
    if username not in users or users[username] != db_client_id:
        # 同步内存状态和数据库状态
        if db_client_id:
            users[username] = db_client_id
            manager.username_to_client[username] = db_client_id
        else:
            print(f"用户 {username} 未连接")
            raise HTTPException(status_code=404, detail="User not connected")

    client_id = users[username]
    if not client_id or client_id not in manager.active_connections:
        print(f"用户 {username} 的连接已失效")
        raise HTTPException(status_code=404, detail="User connection invalid")

    instruction = {
        "type": "voice_instruction",
        "content": message.get("content", ""),
        "timestamp": str(datetime.now())
    }

    print(f"正在发送消息: {instruction}")
    await manager.send_message(instruction, client_id)
    print("消息发送成功")

    return {"status": "Message sent"}


# 获取用户列表
@app.get("/users")
async def get_users():
    with get_db() as conn:
        cursor = conn.execute('SELECT username, client_id FROM users')
        users = {row[0]: row[1] for row in cursor.fetchall()}
        return {
            "users": list(users.keys()),
            "active_connections": {
                username: client_id
                for username, client_id in users.items()
                if client_id
            }
        }


@app.delete("/users/{username}")
async def delete_user(username: str):
    """删除指定用户"""
    if username in users:
        client_id = users[username]
        del users[username]
        if client_id in manager.active_connections:
            await manager.active_connections[client_id].close()
        return {"status": "success", "message": f"User {username} deleted"}
    raise HTTPException(status_code=404, detail="User not found")


@app.put("/users/{username}")
async def update_user(username: str, new_data: dict):
    """更新用户信息"""
    if username not in users:
        raise HTTPException(status_code=404, detail="User not found")

    new_username = new_data.get("new_username")
    if new_username and new_username != username:
        if new_username in users:
            raise HTTPException(status_code=400, detail="New username already exists")

        client_id = users[username]
        del users[username]
        users[new_username] = client_id

        if client_id:
            manager.username_to_client[new_username] = client_id
            if username in manager.username_to_client:
                del manager.username_to_client[username]

    return {"status": "success", "message": f"User {username} updated"}


# 添加测试路由
@app.get("/test-send/{username}")
async def test_send(username: str):
    """测试发送消息的路由"""
    try:
        message = {
            "content": f"这是发送给 {username} 的测试语音指令"
        }
        return await send_instruction(username, message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# 在文件末尾添加
if __name__ == "__main__":
    init_db()  # 初始化数据库
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=37961)