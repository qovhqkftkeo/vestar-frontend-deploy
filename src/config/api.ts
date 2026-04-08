import axios from 'axios';

// .env에 적어둔 백엔드 주소를 가져옵니다. 
// 배포 환경(운영)에서는 자동으로 운영 서버 주소로 바뀝니다.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const apiClient = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',},
});