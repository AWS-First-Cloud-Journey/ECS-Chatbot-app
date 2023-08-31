// File: lib/codepipeline-stack.ts
import { Duration, Stack, StackProps } from "aws-cdk-lib";
import {
  aws_codebuild,
  aws_codecommit,
  aws_codepipeline,
  aws_codepipeline_actions,
  aws_ecr,
  aws_ecs,
  aws_iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

interface CodePipelineProps extends StackProps {
  readonly repoName: string;
  readonly repoBranch: string;
  readonly repoOwner: string;
  readonly ecrRepoName: string;
  readonly service: aws_ecs.FargateService;
}

export class CodePipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: CodePipelineProps) {
    super(scope, id, props);

    // Existing CodeCommit repository
    const codecommitRepository = aws_codecommit.Repository.fromRepositoryName(
      this,
      "CodeCommitChatbot",
      "aws-fcj-repo"
    );

    // Existing ECR repository
    const ecrRepository = aws_ecr.Repository.fromRepositoryName(
      this,
      "EcrRepositoryForChatbot",
      props.ecrRepoName
    );

    // Artifact for source code
    const sourceOutput = new aws_codepipeline.Artifact("SourceOutput");

    // Artifact for CodeBuild output
    const codeBuildOutput = new aws_codepipeline.Artifact("CodeBuildOutput");

    // IAM Role for CodeBuild
    const codebuildRole = new aws_iam.Role(this, "RoleForCodeBuildChatbotApp", {
      roleName: "RoleForCodeBuildChatbotApp",
      assumedBy: new aws_iam.ServicePrincipal("codebuild.amazonaws.com"),
    });

    ecrRepository.grantPullPush(codebuildRole);

    // CodeBuild project
    const ecrBuild = new aws_codebuild.PipelineProject(
      this,
      "BuildChatbotEcrImage",
      {
        projectName: "BuildChatbotEcrImage",
        role: codebuildRole,
        environment: {
          privileged: true,
          buildImage: aws_codebuild.LinuxBuildImage.STANDARD_5_0,
          computeType: aws_codebuild.ComputeType.MEDIUM,
          environmentVariables: {
            ACCOUNT_ID: {
              value: this.account,
              type: aws_codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            },
            REGION: {
              value: this.region,
              type: aws_codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            },
            REPO_NAME: {
              value: props.ecrRepoName,
              type: aws_codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            },
            TAG: {
              value: "latest",
              type: aws_codebuild.BuildEnvironmentVariableType.PLAINTEXT,
            },
          },
        },
        // Use BuildSpec from an asset (path relative to the CDK app)
        buildSpec: aws_codebuild.BuildSpec.fromAsset(
          path.join(__dirname, "./build_spec.yaml")
        ),
      }
    );

    // CodePipeline
    new aws_codepipeline.Pipeline(this, "CodePipelineChatbot", {
      pipelineName: "CodePipelineChatbot",
      stages: [
        // Source
        {
          stageName: "SourceCode",
          actions: [
            new aws_codepipeline_actions.CodeCommitSourceAction({
              actionName: "CodeCommitChatbot",
              repository: codecommitRepository,
              branch: "master",
              output: sourceOutput,
            }),
          ],
        },

        // Build Docker image and push to ECR
        {
          stageName: "BuildChatbotEcrImageStage",
          actions: [
            new aws_codepipeline_actions.CodeBuildAction({
              actionName: "BuildChatbotEcrImage",
              project: ecrBuild,
              input: sourceOutput,
              outputs: [codeBuildOutput],
            }),
          ],
        },

        // Deploy new tag image to ECS service
        {
          stageName: "EcsCodeDeploy",
          actions: [
            new aws_codepipeline_actions.EcsDeployAction({
              actionName: "Deploy",
              service: props.service,
              input: codeBuildOutput,
              deploymentTimeout: Duration.minutes(10),
            }),
          ],
        },
      ],
    });
  }
}
