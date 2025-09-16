```markdown
# 🛡️ Smart Tourist Safety Monitoring & Incident Response System  

A MERN-stack web application developed for **Smart India Hackathon (SIH) 2025**, designed to enhance **tourist safety** using **AI-driven monitoring, geo-fencing alerts, multilingual support, and real-time incident reporting**.  

---

## 🚀 Features  

### 👤 User Features (Tourist)
- Signup/Login with secure JWT authentication.  
- Digital **Tourist ID (QR-based)** for verification.  
- **Emergency SOS button** to instantly alert authorities.  
- Geo-fencing alerts (restricted or dangerous zones).  
- Profile with location and emergency contacts.  
- **Multilingual support** (English, Hindi, French, more to come).  

### 🏛️ Admin/Authority Features  
- Secure **authority dashboard**.  
- **Real-time incident reports** monitoring.  
- Respond to SOS alerts from tourists.  
- Manage & monitor registered tourists.  
- View and update tourist safety status.  

### 🌍 Common Features  
- Role-based navigation (separate navbars for user/admin).  
- Multilingual interface using `react-i18next`.  
- Responsive UI built with Tailwind CSS.  
- REST APIs with MongoDB for data persistence.  

---

## 🛠️ Tech Stack  

**Frontend**  
- React + Vite  
- Tailwind CSS  
- React Router  
- React-i18next (multilingual support)  

**Backend**  
- Node.js + Express  
- MongoDB (Atlas/local)  
- JWT Authentication  

**Other Tools**  
- QR Code Generator (Tourist ID)  
- Map & Geolocation APIs (Geo-fencing + alerts)  
- Postman (API testing)  

---

## 📂 Project Structure  

```

smart-tourist-safety/
│
├── backend/                 # Express + MongoDB backend
│   ├── models/              # Mongoose models
│   │   ├── User.js
│   │   ├── Tourist.js
│   │   └── Sos.js
│   ├── routes/              # API routes
│   │   ├── authRoutes.js
│   │   ├── touristRoutes.js
│   │   └── sosRoutes.js
│   ├── controllers/         # Controller logic
│   ├── middleware/          # Auth & validation middleware
│   ├── config/              # DB connection & JWT secret
│   └── server.js            # Backend entry point
│
├── frontend/                # React + Tailwind frontend
│   ├── src/
│   │   ├── components/      # Navbar, Footer, SOSButton, etc.
│   │   ├── pages/           # Home, About, Login, Signup, Dashboard, etc.
│   │   ├── context/         # Auth context
│   │   ├── i18n.js          # i18n configuration
│   │   └── translations/    # Language JSON files
│   │       ├── en.json
│   │       ├── hi.json
│   │       └── fr.json
│   └── main.jsx
│
├── README.md
└── package.json

````

---

## ⚙️ Installation & Setup  

### 1️⃣ Clone Repository  
```bash
git clone https://github.com/your-username/smart-tourist-safety.git
cd smart-tourist-safety
````

### 2️⃣ Setup Backend

```bash
cd backend
npm install
npm start
```

* Runs on **[http://localhost:5000](http://localhost:5000)**

### 3️⃣ Setup Frontend

```bash
cd frontend
npm install
npm run dev
```

* Runs on **[http://localhost:5173](http://localhost:5173)**

---

## 📡 API Documentation

### 1. Health Check

```http
GET /api/health
```

**Response:**

```json
{ "status": "ok" }
```

---

### 2. Authentication APIs

#### Signup

```http
POST /api/auth/signup
```

**Body:**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "tourist"
}
```

#### Login

```http
POST /api/auth/login
```

**Body:**

```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**

```json
{ "token": "JWT_TOKEN_HERE" }
```

---

### 3. Tourist Management APIs

#### Get All Tourists

```http
GET /api/tourists
```

#### Create Tourist Profile

```http
POST /api/tourists
```

**Body:**

```json
{
  "userId": "USER_ID",
  "name": "John Doe",
  "email": "john@example.com",
  "location": { "latitude": 28.6139, "longitude": 77.2090 },
  "status": "safe",
  "emergencyContacts": ["+91-9876543210"]
}
```

#### Update Tourist Location

```http
PUT /api/tourists/:touristId/location
```

---

### 4. SOS Emergency APIs

#### Get All SOS Alerts

```http
GET /api/sos
```

#### Create SOS Alert

```http
POST /api/sos
```

**Body:**

```json
{
  "touristId": "TOURIST_ID",
  "touristName": "John Doe",
  "location": { "latitude": 28.6139, "longitude": 77.2090 },
  "priority": "high",
  "description": "Emergency situation"
}
```

#### Respond to SOS

```http
PUT /api/sos/:sosId/respond
```

---

## 🌐 Multilingual Support

* Implemented using **react-i18next**.
* Available languages: **English (en), Hindi (hi), French (fr)**.
* More languages can be added easily by extending JSON files inside `translations/`.

Example `en.json`:

```json
{
  "welcome": "Welcome to Tourist Safety System",
  "sos": "Emergency SOS",
  "dashboard": "Incident Dashboard"
}
```

---

## 🔑 Role-Based Navigation

* **Tourist Navbar:** Home, About, SOS, Profile, Logout.
* **Authority Navbar:** Dashboard, Tourists, SOS Alerts, Logout.
* **No Navbar:** Login, Signup.

---

## 🤝 Contribution Guidelines

* Fork the repo & create feature branches (`feature/add-language-support`).
* Follow ESLint + Prettier formatting.
* Add proper commit messages (`feat:`, `fix:`, `docs:`).
* Submit PR with detailed description.

---

## 📌 Future Enhancements

* AI-driven **incident prediction** and **pattern detection**.
* **Mobile app version** (React Native).
* Integration with **police/emergency service APIs**.
* Real-time **push notifications**.

---

## 👨‍💻 Team

Developed by **\[Tech4Good]** for **Smart India Hackathon 2025**.

