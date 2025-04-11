const core = require("@actions/core");
const { context, getOctokit } = require("@actions/github");
const OpenAI = require("openai");

async function run() {
    try {
        const openaiApiKey = core.getInput("openai_api_key", { required: true });
        const promptTemplate = core.getInput("prompt", { required: true });
        const token = core.getInput("github_token", { required: true });

        core.info("Starting the GitHub Action script execution...");
        core.info("OpenAI API Key:", openaiApiKey);
        core.info("Prompt Template:", promptTemplate);
        core.info("GitHub Token:", token);
        core.info("GitHub Context:", JSON.stringify(context));

        const octokit = getOctokit(token);

        const { owner, repo } = context.repo;
        core.info("Owner:", owner);
        core.info("Repo:", repo);
        core.info("SHA:", context.sha);
        core.info("Event:", context.eventName);
        core.info("Payload:", JSON.stringify(context.payload));
        let prNumber = context.payload.pull_request?.number;
        if (!prNumber) {
            const { data: pullRequests } = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
                owner,
                repo,
                commit_sha: context.sha,
            });

            const candidatePullRequests = pullRequests.filter(
                (pr) => context.payload.ref === `refs/heads/${pr.head.ref}` && pr.state === "open"
            );

            prNumber = candidatePullRequests?.[0]?.number;
        }
        core.info("Pull Request Number:", prNumber);

        if (!prNumber) {
            core.setFailed(`No open pull request found for ${context.eventName}, ${context.sha}`);
            return;
        }

        core.info("Fetching pull request details...");
        const { data } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        let body = data.body || "";

        core.info("Pull Request Details:", JSON.stringify(data));
        core.info("Pull Request Body:", body);

        const pr_details = {
            title: data.title,
            body: body.substring(0, 500),
            files: (await octokit.paginate(octokit.rest.pulls.listFiles, {
                owner,
                repo,
                pull_number: prNumber
            })).slice(0, 5),
            commits: (await octokit.paginate(octokit.rest.pulls.listCommits, {
                owner,
                repo,
                pull_number: prNumber
            })).slice(0, 5)
        };

        core.info("Pull Request Details:", JSON.stringify(pr_details));

        const inputPrompt = `${promptTemplate}\n${JSON.stringify(pr_details)}`;

        const client = new OpenAI({ apiKey: openaiApiKey });

        const response = await client.responses.create({
            model: "gpt-4o",
            input: inputPrompt
        });

        const aiDescription = response.output_text.trim();

        core.info("PR Number:", prNumber);
        core.info("Owner:", owner);
        core.info("Repo:", repo);

        if (!prNumber) {
            core.error("No pull request number found.");
        }

        // Log the PR body before attempting to modify it
        core.info("PR Body:", body);

        // Log the output content before updating the PR
        core.info("Output Content:", aiDescription);

        await octokit.rest.pulls.update({
            owner,
            repo,
            body: aiDescription,
            pull_number: prNumber,
        });

        core.setOutput("description", aiDescription);

        core.info(`PR Number: ${prNumber}`);
        core.info(`Owner: ${owner}`);
        core.info(`Repo: ${repo}`);

        if (!prNumber) {
            core.error("No pull request number found.");
        }

        core.info(`PR Body: ${body}`);
        core.info(`Output Content: ${aiDescription}`);

    } catch (error) {
        core.setFailed(error.message);
    }
}

run();