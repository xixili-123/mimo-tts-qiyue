# MiMo TTS → Cloudflare Worker → 栖阅

> **一键部署版**：不需要手动创建 Worker、手动建 Secret、手动配置 Builds。
>
> Cloudflare 官方 Deploy to Cloudflare 会根据本项目配置自动完成项目创建与部署，并在部署流程中提示填写必需的 `MIMO_API_KEY` Secret。

## 🚀 一键部署

如果你的 GitHub 仓库是公开的，可以直接使用：

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/xixili-123/mimo-tts-cloudflare)

部署时只需要：

1. 登录 Cloudflare
2. 按页面提示填写 Worker 名称（默认即可）
3. 填写 **MiMo API Key**
4. 点击 Deploy

**不要把 API Key 写进 GitHub。**

## 接口

部署完成后：

- 健康检查：`GET https://你的-worker.workers.dev/health`
- TTS：`POST https://你的-worker.workers.dev/tts`

TTS 请求：

```json
{
  "text": "你好，这是 MiMo TTS 测试。",
  "voice": "冰糖",
  "style": "自然、清晰、连贯的中文有声小说朗读。语速适中，吐字清楚，人物对白有轻微情绪变化，不要播报腔。"
}
```

成功返回：

`audio/wav`

## 默认配置

- 模型：`mimo-v2.5-tts`
- 默认音色：`冰糖`
- 输出：WAV
- 最大单次文本：12000 字符
- CORS：已开启
- 可选 `TTS_CLIENT_TOKEN`：如果需要限制只有栖阅可以调用，可在 Cloudflare Secrets 中自行增加

## 栖阅

仓库内提供：

`qiyue-tts-adapter-template.json`

部署完成后，只需要把其中的：

`https://YOUR-WORKER.workers.dev/tts`

替换成你的实际 `/tts` 地址。

## 安全

`MIMO_API_KEY` 使用 Cloudflare Secret。

本项目通过 `secrets.required` 声明该 Secret，因此部署时缺少 Key 会在部署阶段直接提示，而不会出现“部署成功后才发现 API Key 没绑定”的情况。

如果 API Key 曾经出现在聊天截图、GitHub、日志或其他公开位置，请立即撤销并重新生成。
