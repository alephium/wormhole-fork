FROM adoptopenjdk/openjdk11:jre-11.0.11_9
# adoptopenjdk/openjdk11:jre is no longer available for arm/v7?

ARG RELEASE=1.3.0-rc3

RUN curl -L https://github.com/alephium/alephium/releases/download/v${RELEASE}/alephium-${RELEASE}.jar -o /alephium.jar && \
  mkdir -p /alephium-home && usermod -d /alephium-home nobody && chown nobody /alephium-home && \
  mkdir -p ~nobody/.alephium && chown nobody ~nobody/.alephium && \
  mkdir -p ~nobody/.alephium-wallets && chown nobody ~nobody/.alephium-wallets

COPY user-devnet.conf /alephium-home/.alephium/user.conf

VOLUME /alephium-home/.alephium

VOLUME /alephium-home/.alephium-wallets

USER nobody

ENTRYPOINT ["java", "-jar", "/alephium.jar"]
