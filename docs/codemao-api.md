# 编程猫API文档

## 概述

本文档记录了编程猫（Codemao）公开API的接口信息，用于从编程猫平台获取作品、用户等数据。

## 基础信息

- **基础URL**: `https://api.codemao.cn`
- **数据格式**: JSON
- **编码**: UTF-8

---

## 作品相关API

### 1. 获取发现页面作品（推荐作品）

**接口地址**: `/creation-tools/v1/pc/discover/subject-work`

**请求方式**: GET

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| offset | number | 否 | 偏移量，从0开始，默认0 |
| limit | number | 是 | 返回数量，最小值5 |

**请求示例**:
```
GET https://api.codemao.cn/creation-tools/v1/pc/discover/subject-work?offset=0&limit=20
```

**响应示例**:
```json
{
  "items": [
    {
      "work_id": 294811327,
      "work_name": "迷宫之反转",
      "preview_url": "https://creation.bcmcdn.com/873/user-files/hash/xxx",
      "user_id": 1141772863,
      "avatar_url": "https://cdn-community.bcmcdn.com/47/community/xxx.png",
      "nickname": "墨名柒淼",
      "views_count": 39758,
      "likes_count": 498
    }
  ],
  "offset": 0,
  "limit": 20,
  "total": 7473,
  "counted": true
}
```

**响应字段说明**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| items | Array | 作品列表 |
| items[].work_id | number | 作品ID |
| items[].work_name | string | 作品名称 |
| items[].preview_url | string | 作品预览图URL |
| items[].user_id | number | 作者用户ID |
| items[].avatar_url | string | 作者头像URL |
| items[].nickname | string | 作者昵称 |
| items[].views_count | number | 浏览次数 |
| items[].likes_count | number | 点赞次数 |
| offset | number | 当前偏移量 |
| limit | number | 当前请求数量 |
| total | number | 总数量 |
| counted | boolean | 是否已统计总数 |

---

### 2. 获取作品详情

**接口地址**: `/creation-tools/v1/works/{workId}`

**请求方式**: GET

**路径参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| workId | number | 是 | 作品ID |

**请求示例**:
```
GET https://api.codemao.cn/creation-tools/v1/works/294811327
```

**响应字段说明**:

| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | number | 作品ID |
| work_name | string | 作品名称 |
| description | string | 作品描述 |
| preview | string | 预览图URL |
| player_url | string | 播放地址 |
| ide_type | string | 编辑器类型 (kitten/nemo等) |
| view_times | number | 浏览次数 |
| liked_times | number | 点赞次数 |
| collect_times | number | 收藏次数 |
| comment_times | number | 评论次数 |
| user_info | Object | 作者信息 |
| user_info.id | number | 作者ID |
| user_info.nickname | string | 作者昵称 |
| user_info.avatar | string | 作者头像 |
| work_label_list | Array | 作品标签列表 |

---

## 用户相关API

### 3. 获取用户作品列表

**接口地址**: `/creation-tools/v1/user/center/work-list`

**请求方式**: GET

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| user_id | number | 是 | 用户ID |
| offset | number | 否 | 偏移量，默认0 |
| limit | number | 否 | 返回数量，默认20 |

**请求示例**:
```
GET https://api.codemao.cn/creation-tools/v1/user/center/work-list?user_id=1141772863&offset=0&limit=20
```

---

### 4. 获取用户信息

**接口地址**: `/tiger/v3/web/accounts/info`

**请求方式**: GET

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| user_id | number | 是 | 用户ID |

**请求示例**:
```
GET https://api.codemao.cn/tiger/v3/web/accounts/info?user_id=1141772863
```

---

## 论坛相关API

### 5. 获取论坛板块列表

**接口地址**: `/web/forums/boards/simples/all`

**请求方式**: GET

**请求示例**:
```
GET https://api.codemao.cn/web/forums/boards/simples/all
```

---

### 6. 获取板块帖子列表

**接口地址**: `/web/forums/boards/{boardId}/posts`

**请求方式**: GET

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 否 | 页码，默认1 |
| page_size | number | 否 | 每页数量，默认20 |

---

### 7. 搜索帖子

**接口地址**: `/web/forums/posts/search`

**请求方式**: GET

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| q | string | 是 | 搜索关键词 |
| page | number | 否 | 页码，默认1 |
| page_size | number | 否 | 每页数量，默认20 |

---

## 其他API

### 8. 获取轮播图

**接口地址**: `/web/banners/all`

**请求方式**: GET

**请求参数**:

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| type | string | 否 | 类型，默认OFFICIAL |

---

## 使用注意事项

1. **请求频率**: 请合理控制请求频率，避免对编程猫服务器造成压力
2. **数据缓存**: 建议对获取的数据进行本地缓存，减少重复请求
3. **版权声明**: 获取的数据版权归原作者所有，使用时请遵守相关法律法规
4. **API变更**: 编程猫可能会随时更新API，请关注官方公告

---

## 更新日志

| 日期 | 版本 | 更新内容 |
|------|------|----------|
| 2026-02-21 | 1.0 | 初始版本，记录发现页面作品API |
