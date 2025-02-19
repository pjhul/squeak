# Install dependencies only when needed
FROM node:16-alpine AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache --virtual libc6-compat python3 make g++ openssl-dev
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=false

# If using npm with a `package-lock.json` comment out above and use below instead
# COPY package.json package-lock.json ./
# RUN npm ci

# Rebuild the source code only when needed
FROM node:16-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

COPY prisma/schema.prisma ./
RUN npx prisma generate

COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.

# PostHog API Key
ENV NEXT_PUBLIC_POSTHOG_API_KEY=phc_GvaEPSuUrUW2TAwV1vfuMjgikOrw5iOm4a4qJZgNi8k

# Due to the way Next.js works, we set the public URL's to a generic string, then replace these in the entrypoint file
ENV NEXT_PUBLIC_OPT_OUT_TRACKING=APP_OPT_OUT_TRACKING

# Sentry hooks into `yarn build` and uploads the source maps to Sentry automatically.
# SENTRY_AUTH_TOKEN needs to be set in the build environment to enable uploading of source maps by the sentry-cli
# This is set via github actions as a build-arg
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

RUN yarn build

# Production image, copy all the files and run next
FROM node:16-alpine AS runner
WORKDIR /app

ENV NODE_ENV production
ARG MAILGUN_API_KEY
ENV MAILGUN_API_KEY=${MAILGUN_API_KEY}
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# You only need to copy next.config.js if you are NOT using the default configuration
# COPY --from=builder /app/next.config.js ./
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Entrypoint files
COPY ./bin/docker ./bin/docker

## Database migrations
COPY --from=builder /app/node_modules ./node_modules
COPY . .

USER nextjs

EXPOSE 3000

ENV PORT 3000

ENTRYPOINT ["./bin/docker"]

CMD ["yarn", "start"]