import { defineConfig } from 'orval';

export default defineConfig({
    'dut-job-fair': {
        input: {
            // URL của OpenAPI JSON spec – backend phải đang chạy
            target: 'http://localhost:3000/docs-json',
        },
        output: {
            // Thư mục để generate code (điều chỉnh theo project frontend của bạn)
            target: './src/api/generated/dut-job-fair.ts',
            schemas: './src/api/generated/model',
            client: 'react-query',        // hoặc 'axios', 'fetch', 'swr', 'vue-query'
            mode: 'tags-split',           // tách file theo tag (auth, scanner, students...)
            mock: false,
            override: {
                mutator: {
                    path: './src/api/axios-instance.ts',   // custom axios instance với JWT header
                    name: 'customInstance',
                },
                query: {
                    useQuery: true,
                    useMutation: true,
                    signal: true,             // React Query v5 AbortSignal support
                },
            },
        },
        hooks: {
            afterAllFilesWrite: 'prettier --write ./src/api/generated',
        },
    },
});
