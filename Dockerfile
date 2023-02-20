FROM node:16-alpine
ADD . /app
WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY .  /app
EXPOSE 8080
ENTRYPOINT ["node", "app.js"]
ENV FORCE_COLOR=1