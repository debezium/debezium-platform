[![License](http://img.shields.io/:license-apache%202.0-brightgreen.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)
[![User chat](https://img.shields.io/badge/chat-users-brightgreen.svg)](https://debezium.zulipchat.com/#narrow/stream/302529-users)
[![Developer chat](https://img.shields.io/badge/chat-devs-brightgreen.svg)](https://debezium.zulipchat.com/#narrow/stream/302533-dev)
[![Google Group](https://img.shields.io/:mailing%20list-debezium-brightgreen.svg)](https://groups.google.com/forum/#!forum/debezium)
[![Stack Overflow](http://img.shields.io/:stack%20overflow-debezium-brightgreen.svg)](http://stackoverflow.com/questions/tagged/debezium)

Copyright Debezium Authors.
Licensed under the [Apache License, Version 2.0](http://www.apache.org/licenses/LICENSE-2.0).

# debezium-platform-stage

![Debezium Stage UI](src/assets/Stage.gif)  
*Debezium Stage UI.*

This repository contains the web-based UI for the Debezium management platform which can be used to orchestrate and control Debezium deployments. The Platform stage UI is a React+Typescript-based Single Page Application built with Vite. [debezium-platform-conductor](https://github.com/debezium/debezium-platform-conductor) is the back-end component for Debezium management platform.

<img width="1728" alt="Debezium Stage UI Screenshot" src="https://github.com/user-attachments/assets/3f4622a5-0584-4891-9200-28da56d1c05d">

<br>

*Debezium Stage UI Screenshot.*

This project is under active development, any contributions are very welcome.


## Requirements
node (version 20.x.x or higher) and yarn (version 1.22.x or higher).

## Quick-start

### Running UI app locally

To quickly start react app locally. 

```bash
git clone https://github.com/debezium/debezium-platform-stage
cd debezium-platform-stage
yarn && yarn dev
```

Stage UI will be available on [http://localhost:3000](http://localhost:3000)  

## Running UI app with backend

### DEV Infrastructure

```bash
git clone https://github.com/debezium/debezium-platform-stage
cd debezium-platform-stage
```

You can set up a running DEV infrastructure with debezium-platform-conductor and Postgres compose.yml:

```
## start containers (using podman)
$ podman compose up -d

(using docker)
$ docker compose up -d
```
    
Platform conductor REST API will be available on local port **8080**.   
Postgres will be available on local port **5432**.   
Platform Stage UI will be available on [http://localhost:3000](http://localhost:3000) 

### Cleanup

later stop running containers.

```
(using podman)
$ podman compose down

(using docker)
$ docker compose down

```

## UI Development

Install all the dependencies
```bash
yarn
```

Running UI web app targeting local dev setup 
```bash
CONDUCTOR_URL={backend_URL} && yarn dev
```

Debezium UI will be available on [http://localhost:3000](http://localhost:3000)  

## Development scripts
```sh
# Install development/build dependencies
yarn

# Start the development server
yarn dev

# Run a production build (outputs to "dist" dir)
yarn build

# Run the test suite
yarn test

# Run the linter
yarn lint

# Start the dev server (run a production build first)
yarn preview
```

## Contributing

The Debezium community welcomes anyone that wants to help out in any way, whether that includes
reporting problems, helping with documentation, or contributing code changes to fix bugs, add tests,
or implement new features.
See [this document](https://github.com/debezium/debezium/blob/main/CONTRIBUTE.md) for details.