# Gemini MCP Server

A TypeScript implementation of a Model Context Protocol (MCP) server that integrates with Google's Gemini Pro model.

## Overview

This project implements an MCP server that wraps Google's Gemini Pro model, allowing applications that support the Model Context Protocol to interact with Gemini.

## Features

- Full MCP compliance for text completions
- Configuration options for temperature, topK, topP, and maxOutputTokens
- Error handling and validation using Zod
- Environment variable configuration

## Prerequisites

- Node.js 18.x or higher
- A Google AI API key for Gemini

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Copy `.env.example` to `.env` and add your Gemini API key:
   ```
   GEMINI_API_KEY=your-api-key-here
   PORT=3000
   ```

## Building

```
npm run build
```

## Running

```
npm start
```

Or for development with auto-reloading:

```
npm run dev
```

## MCP Capabilities

The server implements the following MCP features:

- **Completions**: Generate text completions from Gemini Pro

## Configuration Options

When making requests to the server, you can customize Gemini's behavior with these options:

- `temperature` (0-1): Controls randomness. Lower values make output more deterministic. Default: 0.7
- `topK` (1-40): Limits token selection to top K options. Default: 40
- `topP` (0-1): Nucleus sampling - only considers tokens with combined probability mass of topP. Default: 0.95
- `maxOutputTokens` (1-8192): Maximum number of tokens to generate. Default: 4096

## Example Usage

Using the MCP SDK in your client application:

```typescript
import { MCPClient } from '@modelcontextprotocol/sdk';

// Connect to the MCP server
const client = new MCPClient('http://localhost:3000');

// Generate a completion
const response = await client.generateCompletion({
  prompt: "Write a poem about artificial intelligence",
  options: {
    temperature: 0.8,
    maxOutputTokens: 2048
  }
});

console.log(response.results[0].text);
```

## License

MIT
