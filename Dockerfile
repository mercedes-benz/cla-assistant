# SPDX-FileCopyrightText: 2022 SAP SE or an SAP affiliate company and CLA-assistant contributors
#
# SPDX-License-Identifier: Apache-2.0

FROM node:16-alpine

EXPOSE 5000

RUN addgroup -S cla-assistant
RUN adduser -S -D -G cla-assistant cla-assistant

COPY . /cla-assistant
WORKDIR /cla-assistant

RUN npm install && npm run build && npm prune --production
RUN \
  apk add --no-cache nodejs npm su-exec && \
  apk add --no-cache --virtual .build-deps git curl bzip2 patch make g++ && \
  addgroup -S cla-assistant && \
  adduser -S -D -G cla-assistant cla-assistant && \
  chown -R cla-assistant:cla-assistant /cla-assistant && \
  su-exec cla-assistant /bin/sh -c 'cd /cla-assistant && npm install && node_modules/grunt-cli/bin/grunt build && rm -rf /home/cla-assistant/.npm .git' && \
  apk del .build-deps

USER cla-assistant

CMD ["npm", "start"]
