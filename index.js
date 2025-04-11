const core = require("@actions/core");
const github = require("@actions/github");
const OpenAI = require("openai");

async function run() {
    try {
        const openaiApiKey = core.getInput("openai_api_key");
        const promptTemplate = core.getInput("prompt");
        const octokit = github.getOctokit(core.getInput("github_token"));

        const { context } = github;
        const { owner, repo } = context.repo;
        const pull_number = context.payload.pull_request.number;
        if (!pull_number) {
            const { data: pullRequests } =
                await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
                    owner,
                    repo,
                    commit_sha: context.sha,
                });

            const candidatePullRequests = pullRequests.filter(
                (pr) =>
                    context.payload.ref === `refs/heads/${pr.head.ref}` &&
                    pr.state === "open",
            );

            pull_number = candidatePullRequests?.[0]?.number;
        }

        if (!pull_number) {
            setFailed(
                `No open pull request found for ${context.eventName}, ${context.sha}`,
            );
            return;
        }

        const { data: pr } = await octokit.rest.pulls.get({
            owner,
            repo,
            pull_number: pull_number
        });

        const pr_details = {
            title: pr.title,
            body: pr.body ? pr.body.substring(0, 500) : "",
            files: (await octokit.paginate(octokit.rest.pulls.listFiles, {
                owner,
                repo,
                pull_number
            })).slice(0, 5),
            commits: (await octokit.paginate(octokit.rest.pulls.listCommits, {
                owner,
                repo,
                pull_number
            })).slice(0, 5)
        };

        console.log(`Pull Request Number: ${pull_number}`);
        console.log(`Repository: ${owner}/${repo}`);
        console.log(`PR Details: ${JSON.stringify(pr_details)}`);

        const inputPrompt = `${promptTemplate}\n${JSON.stringify(pr_details)}`;

        const client = new OpenAI({ apiKey: openaiApiKey });

        const response = await client.responses.create({
            model: "gpt-4o",
            input: inputPrompt
        });

        const aiDescription = response.output_text.trim();

        await octokit.rest.pulls.update({
            owner,
            repo,
            pull_number: pull_number,
            body: aiDescription
        });

        core.setOutput("description", aiDescription);

    } catch (error) {
        core.setFailed(error.message);
    }
}

run();