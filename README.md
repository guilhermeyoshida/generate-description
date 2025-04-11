# Generate PR Description

This GitHub Action generates a detailed pull request description using OpenAI's GPT-4o model.

## Repository and Version

This action is hosted in the repository [guilhermeyoshida/generate-description](https://github.com/guilhermeyoshida/generate-description) and is currently at version `0.0.1`.

## Inputs

- `openai_api_key`: **Required** OpenAI API Key.
- `github_token`: **Required** GitHub Token.
- `prompt`: **Required** Prompt template for generating PR description.

## Outputs

- `description`: The generated PR description.

## Example Usage

```yaml
name: Generate PR Description
on:
  pull_request

jobs:
  generate-description:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v2

      - name: Generate PR Description
        uses: guilhermeyoshida/generate-description@latest
        with:
          openai_api_key: ${{ secrets.OPENAI_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          prompt: "Provide a detailed analysis of the pull request changes, focusing on the purpose and benefits of the modifications. Explain the technical improvements and enhancements introduced, and how they contribute to the overall project goals. Highlight any significant changes in functionality, performance, or security, and discuss the potential impacts on the system. Avoid listing file counts or line changes; instead, focus on the essence and rationale behind the changes."
```