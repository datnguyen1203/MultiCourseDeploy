// src/axiosConfig.js
import axios from "axios";
const instance = axios.create({
  baseURL: "https://multicourseserver.onrender.com", //backend

  headers: {
    "Content-Type": "application/json",
  },
});

export default instance;
