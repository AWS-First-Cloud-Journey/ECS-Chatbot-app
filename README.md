# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

## CDK Deploy

- Step 1. Deploy EcrStack
- Step 2. Build and push an ECR image manulaly
- Step 3. Deploy the EcsStack
- Step 4. Deploy the CodePipelineChatbotStack

> [!IMPORTANT]
> Please provide parameters in /bin/aws-ecs-demo.ts
> Please provide Hugging Face API Key in /chatbot-app/.env
> Due to rate limite of free API, sometimes you might experience no response from the bot.

**Step 1. Deploy EcrStack which create a ECR repository**

```bash
cdk deploy EcrStack
```

**Step 2. Deploy the EcsStack**

Goto the bin directory and deploy the ecs cluster using cdk

```bash
cdk deploy EcsStack
```

**Step 3. Deploy the CodePipeline**

```bash
cdk deploy CodePipelineChatbotStack
```

## Delete Resource

> [!WARNING]  
> Please be aware [cdk issue when destroying ecs cluster](https://github.com/aws/aws-cdk/issues/19275)

First destroy the codepipeline stack

```bash
cdk destroy CodePipelineChatbotStack
```

Then destroy the EcrStack

```bash
cdk destroy EcrStack
```

Finally destroy the EcsStack

```bash
cdk destroy EcsStack
```

It is possible to automate all in one big application, but for demo purpose, just make it simple.CodePipelineChatbotStack