const core = require("@actions/core");
const { context, getOctokit } = require("@actions/github");
const OpenAI = require("openai");

async function run() {
    try {
        const openaiApiKey = core.getInput("openai_api_key", { required: true });
        const promptTemplate = core.getInput("prompt", { required: true });
        const token = core.getInput("github_token", { required: true });
        const octokit = getOctokit(token);

        const { owner, repo } = context.repo;
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

        if (!prNumber) {
            core.setFailed(`No open pull request found for ${context.eventName}, ${context.sha}`);
            return;
        }

        const { data } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: prNumber,
        });

        let body = data.body || "";

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

        console.log(`Pull Request Number: ${prNumber}`);
        console.log(`Repository: ${owner}/${repo}`);
        console.log(`PR Details: ${JSON.stringify(pr_details)}`);

        const inputPrompt = `${promptTemplate}\n${JSON.stringify(pr_details)}`;

        const client = new OpenAI({ apiKey: openaiApiKey });

        const response = await client.responses.create({
            model: "gpt-4o",
            input: inputPrompt
        });

        const aiDescription = response.output_text.trim();

        console.log("PR Number:", prNumber);
        console.log("Owner:", owner);
        console.log("Repo:", repo);

        if (!prNumber) {
            console.error("No pull request number found.");
        }

        // Log the PR body before attempting to modify it
        console.log("PR Body:", body);

        // Log the output content before updating the PR
        console.log("Output Content:", aiDescription);

        await octokit.rest.pulls.update({
            owner,
            repo,
            body: aiDescription,
            pull_number: prNumber,
        });

        core.setOutput("description", aiDescription);

    } catch (error) {
        core.setFailed(error.message);
    }
}

run();