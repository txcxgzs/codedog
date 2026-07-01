const { DataTypes, Op } = require('sequelize');

function getExpiration(sessionData, ttlMs) {
    const cookieExpires = sessionData?.cookie?.expires;
    if (cookieExpires) {
        return new Date(cookieExpires);
    }

    const originalMaxAge = sessionData?.cookie?.originalMaxAge;
    if (Number.isFinite(originalMaxAge) && originalMaxAge > 0) {
        return new Date(Date.now() + originalMaxAge);
    }

    return new Date(Date.now() + ttlMs);
}

function createSequelizeSessionStore(session, sequelize, { ttlMs = 30 * 60 * 1000 } = {}) {
    class SequelizeSessionStore extends session.Store {
        constructor() {
            super();

            this.SessionRecord = sequelize.define('SessionRecord', {
                sid: {
                    type: DataTypes.STRING(255),
                    primaryKey: true
                },
                expires: {
                    type: DataTypes.DATE,
                    allowNull: false
                },
                data: {
                    type: DataTypes.TEXT('long'),
                    allowNull: false
                }
            }, {
                tableName: 'sessions',
                timestamps: false
            });

            // 保存 interval 句柄到 this 上，方便 stopCleanup() 时清理
            this._cleanupTimer = setInterval(() => {
                this.clearExpired(() => {});
            }, 15 * 60 * 1000);
            this._cleanupTimer.unref();
        }

        stopCleanup() {
            if (this._cleanupTimer) {
                clearInterval(this._cleanupTimer);
                this._cleanupTimer = null;
            }
        }

        sync() {
            return this.SessionRecord.sync();
        }

        async get(sid, callback) {
            try {
                const record = await this.SessionRecord.findByPk(sid);
                if (!record) {
                    return callback(null, null);
                }

                if (new Date(record.expires).getTime() <= Date.now()) {
                    await this.destroy(sid, () => {});
                    return callback(null, null);
                }

                let sessionData;
                try {
                    sessionData = JSON.parse(record.data);
                } catch (parseError) {
                    console.error('解析会话数据失败:', parseError);
                    await this.destroy(sid, () => {});
                    return callback(null, null);
                }

                return callback(null, sessionData);
            } catch (error) {
                return callback(error);
            }
        }

        async set(sid, sessionData, callback) {
            try {
                await this.SessionRecord.upsert({
                    sid,
                    expires: getExpiration(sessionData, ttlMs),
                    data: JSON.stringify(sessionData)
                });
                return callback?.(null);
            } catch (error) {
                return callback?.(error);
            }
        }

        async destroy(sid, callback) {
            try {
                await this.SessionRecord.destroy({ where: { sid } });
                return callback?.(null);
            } catch (error) {
                return callback?.(error);
            }
        }

        async touch(sid, sessionData, callback) {
            try {
                const [updated] = await this.SessionRecord.update({
                    expires: getExpiration(sessionData, ttlMs)
                }, {
                    where: { sid }
                });

                // M20: updated=0 表示会话不存在或已过期，不重新 set 避免复活已过期会话
                if (updated === 0) {
                    return callback?.(null);
                }

                return callback?.(null);
            } catch (error) {
                return callback?.(error);
            }
        }

        async clearExpired(callback) {
            try {
                await this.SessionRecord.destroy({
                    where: {
                        expires: { [Op.lte]: new Date() }
                    }
                });
                return callback?.(null);
            } catch (error) {
                return callback?.(error);
            }
        }
    }

    return new SequelizeSessionStore();
}

module.exports = { createSequelizeSessionStore };
