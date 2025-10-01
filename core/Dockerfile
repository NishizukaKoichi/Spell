FROM rust:1.75-alpine AS builder

WORKDIR /app
COPY . .
RUN apk add --no-cache musl-dev
RUN cargo build --release

FROM alpine:latest
RUN apk add --no-cache ca-certificates
WORKDIR /app

COPY --from=builder /app/target/release/service-runner /app/service-runner
COPY --from=builder /app/.env.production /app/.env

EXPOSE 8080
CMD ["./service-runner"]