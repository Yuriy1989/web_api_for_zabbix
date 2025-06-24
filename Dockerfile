FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY . ./
RUN npm run build

# Очистка временных файлов и зависимостей, если они не нужны для следующего этапа
RUN rm -rf ./src ./node_modules

FROM nginx:alpine AS frontendzabix
WORKDIR /app
COPY --from=builder /app/build /usr/share/nginx/html
COPY ./nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 4001
CMD [ "nginx", "-g", "daemon off;" ]