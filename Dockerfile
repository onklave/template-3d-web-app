# Build the Vite static site, then serve it from a tiny, dependency-free Go
# server. The platform runs tenant containers as a NON-ROOT user (uid 10001) on
# a READ-ONLY root filesystem, with an HTTP /health probe on port 3000. This
# image satisfies all three with no extra config — no nginx temp dirs, no
# writable paths, no privileged ports.

# 1. Build the static assets (-> /app/dist).
#
# Vite bakes VITE_* at BUILD time, so the content host has to arrive here as a
# build arg — setting it on the running container does nothing. The platform
# passes whatever `onklave.yaml` declares under `services[].build.args`. Empty
# default ⇒ the app resolves models against its own origin and the scene falls
# back to its procedural placeholder, so a plain `docker build` still works.
#
# NEVER pass a secret this way: build args are readable from image history and a
# VITE_ value is compiled into the shipped JavaScript.
FROM node:26-alpine AS web
WORKDIR /app
ARG VITE_CONTENT_BASE_URL=""
ARG VITE_MODEL_PATH=""
ENV VITE_CONTENT_BASE_URL=$VITE_CONTENT_BASE_URL \
    VITE_MODEL_PATH=$VITE_MODEL_PATH
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 2. Build the static file server (static binary, no libc).
FROM golang:1.26-alpine AS server
WORKDIR /src
COPY server/go.mod ./
COPY server/*.go ./
RUN CGO_ENABLED=0 go build -trimpath -o /server .

# 3. Minimal runtime: just the server binary + the built assets.
FROM gcr.io/distroless/static-debian13:nonroot
COPY --from=web /app/dist /www
COPY --from=server /server /server
EXPOSE 3000
ENTRYPOINT ["/server"]
