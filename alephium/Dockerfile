FROM adoptopenjdk/openjdk11:jre-11.0.11_9

ARG RELEASE=1.4.0

# RUN curl -L https://github.com/alephium/alephium/releases/download/v${RELEASE}/alephium-${RELEASE}.jar -o /alephium.jar
COPY alephium-1.4.0.jar /alephium.jar

ENTRYPOINT ["java", "-jar", "/alephium.jar"]
