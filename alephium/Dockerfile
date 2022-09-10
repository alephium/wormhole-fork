FROM adoptopenjdk/openjdk11:jre-11.0.11_9

ARG RELEASE=1.5.0-rc7

RUN curl -L https://github.com/alephium/alephium/releases/download/v${RELEASE}/alephium-${RELEASE}.jar -o /alephium.jar

ENTRYPOINT ["java", "-jar", "/alephium.jar"]
