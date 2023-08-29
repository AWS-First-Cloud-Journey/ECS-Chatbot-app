#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { EcsStack } from "../lib/ecs-stack";
import { CodePipelineStack } from "../lib/codepipeline-stack";
import { EcrStack } from "../lib/ecr-stack";

const app = new cdk.App();

// create a ecr repository
const ecr = new EcrStack(app, "EcrStack", {
  repoName: "aws-fcj-repo",
});

// create an ecs cluster
const ecs = new EcsStack(app, "Ecs-CDK-Stack", {
  vpcId: "vpc-0861e4475acf1ac1d",
  vpcName: "project-vpc",
  ecrRepoName: ecr.repoName,
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

// create a pipeline
new CodePipelineStack(app, "CodePipelineChatbotStack", {
  repoName: "aws-fcj-repo",
  repoBranch: "master",
  repoOwner: "awscommunitybuilder",
  ecrRepoName: ecr.repoName,
  service: ecs.service,
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});