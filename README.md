# 🌍 لوحة العمليات العسكرية — دليل الرفع على Render.com

## الخطوات (5 دقائق فقط)

### 1️⃣ حمّل الملفات على GitHub
1. افتح [github.com/new](https://github.com/new)
2. سمّي الـ repo: `milboard`
3. ارفع هذه الملفات:
   - `server.js`
   - `package.json`
   - مجلد `public/` (فيه `index.html`)

### 2️⃣ ارفع على Render.com
1. افتح [render.com](https://render.com) وسجّل مجاناً
2. اضغط **"New +"** → **"Web Service"**
3. ربط GitHub repo ديالك
4. إعدادات الـ service:
   - **Name:** `milboard`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. اضغط **"Create Web Service"**

### 3️⃣ أضف الـ API Key
في صفحة الـ service على Render:
1. اذهب لـ **"Environment"**
2. أضف متغير:
   - **Key:** `AIS_KEY`
   - **Value:** `82a2564216a5c0e2ca666097d7652f6982528356`
3. اضغط **"Save Changes"** → سيعيد Render التشغيل تلقائياً

### 4️⃣ افتح الموقع
بعد دقيقتين، ستجد رابط مثل:
```
https://milboard-xxxx.onrender.com
```
افتح `index.html` في المتصفح، حط الرابط في المودال، واضغط **"اتصل بالسيرفر"** 🚀

---

## APIs المستخدمة
| API | ما تجيب | مجاني؟ |
|-----|---------|--------|
| OpenSky Network | طيران حقيقي فوق الشرق الأوسط | ✅ مجاني |
| AISstream.io | سفن بحرية حية عبر WebSocket | ✅ مجاني |
| NASA FIRMS | نقاط الحرارة خلال 24 ساعة | ✅ مجاني |
