import axios from "axios";
import { backendBaseUrl } from "./backendUrl";

const defaultHeader = {
  "Content-Type": "application/json",
  Accept: "application/json",
};

export const axiosWrapper = axios.create({
  baseURL: backendBaseUrl,
  withCredentials: true,
  headers: { ...defaultHeader },
});
