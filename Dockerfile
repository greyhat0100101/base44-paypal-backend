
FROM denoland/deno:1.42.0

WORKDIR /app

COPY . .

EXPOSE 8080

CMD ["run", "--allow-net", "--allow-env", "server/index.ts"]
