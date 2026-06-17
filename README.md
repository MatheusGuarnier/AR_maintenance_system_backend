# AR-BACKEND

This repository contains the backend service developed for the *AR-Enhanced Maintenance Support System* project.  
It provides the core API logic, database handling, and middleware structure for managing tool tracking and fault visualisation in an Augmented Reality (AR) context.

---

##  Project Structure

```
AR-BACKEND/
├── src/
│   ├── routes/          # API endpoints
│   ├── middleware/      # Authentication, validation, and request handling
│   └── config/          # Configuration files and environment setup
├── ar_maintenance.db    # Local database for simulation
├── package.json         # Project metadata and dependencies
├── package-lock.json    # Dependency lock file
└── node_modules/        # Installed packages
```

---

##  Features

- RESTful API architecture  
- Fault logging and retrieval endpoints  
- Tool tracking and verification logic  
- Middleware-based request validation  
- Local database integration (`ar_maintenance.db`)  
- Modular configuration for scalability

---

##  Technologies Used

- **Node.js**  
- **Express.js**  
- **SQLite** (or other local DB engine)  
- **JavaScript / TypeScript**  
- **CORS and environment configuration**

---

##  How to Run

1. Install dependencies:
   ```bash
   npm install
   
2. Start the server:
   ```bash
   npm start

3. Access the API at:
   http://localhost:3000

