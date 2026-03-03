// src/api/axios-instance.ts
// Custom axios instance cho Orval – tự động gắn Bearer token từ localStorage
import axios, { AxiosError, AxiosRequestConfig } from 'axios';

export const axiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api',
    headers: { 'Content-Type': 'application/json' },
});

// Tự động gắn Bearer token
axiosInstance.interceptors.request.use((config) => {
    const token =
        typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (token && config.headers) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
});

// Tự động refresh khi 401 (tùy chọn)
axiosInstance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
        if (error.response?.status === 401) {
            // TODO: gọi POST /api/auth/refresh và retry
        }
        return Promise.reject(error);
    },
);

/**
 * Hàm customInstance để Orval gọi thay vì axios trực tiếp.
 * Orval sẽ truyền config vào đây.
 */
export const customInstance = <T>(
    config: AxiosRequestConfig,
    options?: AxiosRequestConfig,
): Promise<T> => {
    const source = axios.CancelToken.source();
    const promise = axiosInstance({
        ...config,
        ...options,
        cancelToken: source.token,
    }).then(({ data }) => data);

    // @ts-expect-error Orval cancel pattern
    promise.cancel = () => {
        source.cancel('Query was cancelled');
    };

    return promise;
};
