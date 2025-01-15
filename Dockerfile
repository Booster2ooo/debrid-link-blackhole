FROM node:18.19.1-alpine AS build

RUN mkdir -p /usr/src/app/node_modules && chown -R node:node /usr/src/app
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "tsconfig.json", "declarations.d.ts", "./"]
COPY [ "./src/", "./src/"]
RUN npm ci
RUN npm run build
RUN rm ./src -rf

FROM node:18.19.1-alpine AS host
COPY --from=build /usr/src/app /usr/app
WORKDIR /usr/app
# RUN mkdir -p /data && chown -R node:node /data
# RUN chown -R node:node /usr/app
# USER node
ENV NODE_ENV=production
ENV DATA=/data
CMD ["npm", "start"]
