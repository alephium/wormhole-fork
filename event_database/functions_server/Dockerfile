# syntax=docker.io/docker/dockerfile:experimental@sha256:de85b2f3a3e8a2f7fe48e8e84a65f6fdd5cd5183afa6412fff9caa6871649c44
FROM docker.io/golang:1.18.6@sha256:60dd47f8883de5cf2af2e2c5e00bdf4a304d39af63e617ac559671f9f87982f5

WORKDIR /app

COPY ./configs /configs
ADD ./event_database .

WORKDIR /app/functions_server
RUN --mount=type=cache,target=/root/.cache --mount=type=cache,target=/go \
    go build -mod=readonly -o /functions main.go

CMD ["/functions"]
