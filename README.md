# Polaris Secure Proxy

Fr0ntierX's Polaris Secure Proxy is an HTTP proxy server designed for private key management and encrypted communication for [Polaris Secure Containers](https://www.fr0ntierx.com/polaris).

## Overview

Polaris Secure Proxy is an essential part of the [Polaris Secure Container](https://www.fr0ntierx.com/) architecture, facilitating end-to-end encryption between containers and external services and application. Polaris Secure Proxy is commercially available as part of the [Polaris Secure Container](https://www.fr0ntierx.com/) series on the Microsoft Azure and Google Cloud marketplaces. This repository is accessible for code inspection and verification of the full build pipeline.

### Encryption Proxy

Polaris Secure Proxy is suitable for applications that communicate via the HTTP protocol. It can be configured to transparently encrypt and decrypt all HTTP requests and responses using an integrated encryption scheme. For further details, please refer to the [Polaris SDK](https://github.com/Fr0ntierX/polaris-sdk).

### Trusted Execution Environments

All communication between Polaris Secure Proxy and external servers or devices remains encrypted. Communication between the proxy and the workload is unencrypted, as it is designed to operate within a Trusted Execution Environment (TEE) where memory encryption is utilized.

### Key management

Polaris Secure Proxy provides a unified interface to use the private keys required for encrypting and decrypting HTTP requests and responses. It can be configured to use various key management systems, such as ephemeral keys, Azure Key Vault or Google Cloud KMS. Since the proxy is designed to operate within a Trusted Execution Environment (TEE), keys are accessed through an attestation policy to verify usage within the TEE. Without this verification, access to the private keys is denied.

## Usage

The official Docker image for Polaris Secure Proxy is available on Docker Hub at [fr0ntierx/polaris-proxy](https://hub.docker.com/r/fr0ntierx/polaris-proxy). The only required variable is the URL of the workload to which the proxy will forward communication: `POLARIS_CONTAINER_WORKLOAD_BASE_URL`. The proxy can be started with the following command:

```bash
docker run -it -e POLARIS_CONTAINER_WORKLOAD_BASE_URL="http://localhost:3001" fr0ntierx/polaris-proxy
```

For more information on all parameters, please refer to the [Polaris Proxy Documentation](https://docs.fr0ntierx.com/polaris-proxy).

## Examples

Additional details and examples of Polaris Secure Proxy use cases can be found in the [examples directory](examples).

### Public Cloud Providers Registries

Official images are also available on the following public Docker registries:

- Azure: `fr0ntierxpublic.azurecr.io/polaris-proxy`
- Google Cloud: `us-docker.pkg.dev/fr0ntierx-public/fr0ntierx-public-registry/polaris-proxy`

### Build pipeline

The Docker images are built and pushed to the public registries using the GitHub Actions CI/CD pipeline. Users can view the complete supply chain of images in the [Actions section](https://github.com/Fr0ntierX/polaris-proxy/actions) to verify the integrity of the images and the build process.

### Local usage

For users interested in experimenting with the proxy locally, it can be started by installing the dependencies and running the server with the following commands:

```bash
export POLARIS_CONTAINER_WORKLOAD_BASE_URL="http://localhost:3001"

yarn install

yarn dev
```

## About Polaris

Fr0ntierX’s Polaris Secure Containers encrypt data throughout its lifecycle and isolate sensitive information from cloud providers or unauthorized entities by securing application deployment within a TEE. For more information about Polaris Secure Containers, please visit the [website](https://www.fr0ntierx.com/polaris).

## Documentation

For more information about the Polaris Secure Proxy, please visit the [Polaris Documentation](https://docs.fr0ntierx.com/polaris-proxy) website.

## Support

If you encounter any problmes please refer to the [documentation](https://docs.fr0ntierx.com/polaris-proxy) or create an [Issue](https://github.com/Fr0ntierX/polaris-proxy/issues).

## License

Polaris Secure Proxy is licensed under the [GNU AGPL v3](LICENSE) and is not available for commercial use without a subscription to a Polaris Secure Container product through the Microsoft Azure or Google Cloud marketplace.
