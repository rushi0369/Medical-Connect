import axios from 'axios'

/** The one Axios instance used for every call to the MediCare backend. */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // Sends the HTTP-only login cookie with each request (Phase 2).
  withCredentials: true,
  timeout: 10_000,
})
