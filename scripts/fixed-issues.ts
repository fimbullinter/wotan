import {withCustomRequest} from '@octokit/graphql';
import * as issueParser from 'issue-parser';

export async function* fixedIssues(owner: string, repo: string, request: Parameters<typeof withCustomRequest>[0], startOid: string, endOid: string) {
    const parser = issueParser('github');
    const graphql = withCustomRequest(request);

    let cursor: string | undefined;
    const seen = new Set<number>();
    function* maybeYield(number: number) {
        if (!seen.has(number)) {
            seen.add(number);
            yield number;
        }
    }

    outer: while (true) {
        interface Response {
            repository: {
                object: {
                    history: {
                        pageInfo: {
                            endCursor: string;
                            hasNextPage: boolean;
                        };
                        nodes: Array<{
                            oid: string;
                            messageBody: string;
                            author: {
                                user: {
                                    login: string;
                                };
                            };
                            associatedPullRequests: {
                                nodes: Array<{
                                    number: number;
                                    body: string;
                                    timelineItems: {
                                        nodes: Array<{
                                            __typename: 'ConnectedEvent' | 'DisconnectedEvent';
                                            number: number;
                                        }>;
                                    };
                                }>;
                            };
                        }>;
                    };
                };
            };
        }
        const result: Response = await graphql(
            `
              query lastIssues($owner: String!, $repo: String!, $startOid: GitObjectID!, $cursor: String) {
                repository(name: $repo, owner: $owner) {
                  object(oid: $startOid) {
                    ... on Commit {
                      history(first: 100, after: $cursor) {
                        pageInfo {
                          endCursor
                          hasNextPage
                        }
                        nodes {
                          oid
                          messageBody
                          author {
                            user {
                              login
                            }
                          }
                          associatedPullRequests(first: 10) {
                            nodes {
                              number
                              body
                              timelineItems(itemTypes: [CONNECTED_EVENT, DISCONNECTED_EVENT], first: 250) {
                                nodes {
                                  __typename
                                  ... on DisconnectedEvent {
                                    subject {
                                      ... on Issue {
                                        number
                                      }
                                    }
                                  }
                                  ... on ConnectedEvent {
                                    subject {
                                      ... on Issue {
                                        number
                                      }
                                    }
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            `,
            {
                owner,
                repo,
                startOid,
                cursor,
            }
        );

        for (const commit of result.repository.object.history.nodes) {
            if (commit.oid === endOid)
                break outer;
            if (commit.author.user.login === 'renovate-bot')
                continue;
            if (commit.associatedPullRequests.nodes.length === 0 && commit.messageBody) {
                // issues referenced via closing keyword in commit message
                for (const closeRef of parser(commit.messageBody).actions.close ?? [])
                    if (closeRef.slug === undefined || closeRef.slug === `${owner}/${repo}`)
                        yield* maybeYield(+closeRef.issue);
            }
            for (const pr of commit.associatedPullRequests.nodes) {
                // issues linked in Github UI
                const manuallyLinkedIssues = new Set<number>();
                for (const event of pr.timelineItems.nodes)
                    manuallyLinkedIssues[event.__typename === 'ConnectedEvent' ? 'add' : 'delete'](event.number);
                for (const number of manuallyLinkedIssues)
                    yield* maybeYield(number);
                // issues referenced via closing keyword in PR description
                for (const closeRef of parser(pr.body).actions.close ?? [])
                    if (closeRef.slug === undefined || closeRef.slug === `${owner}/${repo}`)
                        yield* maybeYield(+closeRef.issue);
            }
        }

        if (!result.repository.object.history.pageInfo.hasNextPage) {
            break;
        }
        cursor = result.repository.object.history.pageInfo.endCursor;
    }
}
