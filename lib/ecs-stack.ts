import {
    Aspects,
    aws_ec2,
    aws_ecr,
    aws_ecs,
    aws_elasticloadbalancingv2,
    aws_iam,
    Duration,
    IAspect,
    Stack,
    StackProps,
  } from "aws-cdk-lib";
  import { Effect } from "aws-cdk-lib/aws-iam";
  import { Construct, IConstruct } from "constructs";
  
  interface EcsProps extends StackProps {
    vpcId: string;
    vpcName: string;
    ecrRepoName: string;
  }
  
  export class EcsStack extends Stack {
    public readonly service: aws_ecs.FargateService;
  
    constructor(scope: Construct, id: string, props: EcsProps) {
      super(scope, id, props);
  
      Aspects.of(this).add(new CapacityProviderDependencyAspect());
  
      // lookup an existed vpc
      const vpc = aws_ec2.Vpc.fromLookup(this, "LookUpVpc", {
        vpcId: props.vpcId,
        vpcName: props.vpcName,
      });
  
      // ecs cluster
      const cluster = new aws_ecs.Cluster(this, "EcsClusterForWebServer", {
        vpc: vpc,
        clusterName: "EcsClusterForWebServer",
        containerInsights: true,
        enableFargateCapacityProviders: true,
      });
  
      // task role pull ecr image
      const executionRole = new aws_iam.Role(
        this,
        "RoleForEcsTaskToPullEcrChatbotImage",
        {
          assumedBy: new aws_iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
          roleName: "RoleForEcsTaskToPullEcrChatbotImage",
        }
      );
  
      executionRole.addToPolicy(
        new aws_iam.PolicyStatement({
          effect: Effect.ALLOW,
          actions: ["ecr:*"],
          resources: ["*"],
        })
      );
  
      // ecs task definition
      const task = new aws_ecs.FargateTaskDefinition(
        this,
        "TaskDefinitionForWeb",
        {
          family: "latest",
          cpu: 2048,
          memoryLimitMiB: 4096,
          runtimePlatform: {
            operatingSystemFamily: aws_ecs.OperatingSystemFamily.LINUX,
            cpuArchitecture: aws_ecs.CpuArchitecture.X86_64,
          },
          // taskRole: "",
          // retrieve container images from ECR
          // executionRole: executionRole,
        }
      );
  
      // taask add container
      task.addContainer("NextChatbotContainer", {
        containerName: "aws-fcj-repo",
        memoryLimitMiB: 4096,
        memoryReservationMiB: 4096,
        stopTimeout: Duration.seconds(120),
        startTimeout: Duration.seconds(120),
        environment: {
          FHR_ENV: "DEPLOY",
        },

        image: aws_ecs.ContainerImage.fromEcrRepository(
          aws_ecr.Repository.fromRepositoryName(
            this,
            "aws-fcj-repo",
            props.ecrRepoName
          )
        ),
        portMappings: [{ containerPort: 3000 }],
      });
  
      // service
      const service = new aws_ecs.FargateService(this, "ChatbotService", {
        vpcSubnets: {
          subnetType: aws_ec2.SubnetType.PUBLIC,
        },
        assignPublicIp: true,
        cluster: cluster,
        taskDefinition: task,
        desiredCount: 2,
        // deploymentController: {
        // default rolling update
        // type: aws_ecs.DeploymentControllerType.ECS,
        // type: aws_ecs.DeploymentControllerType.CODE_DEPLOY,
        // },
        capacityProviderStrategies: [
          {
            capacityProvider: "FARGATE",
            weight: 1,
          },
          {
            capacityProvider: "FARGATE_SPOT",
            weight: 0,
          },
        ],
      });
  
      // scaling on cpu utilization
      const scaling = service.autoScaleTaskCount({
        maxCapacity: 4,
        minCapacity: 2,
      });
  
      scaling.scaleOnMemoryUtilization("CpuUtilization", {
        targetUtilizationPercent: 50,
      });
  
      // application load balancer
      const alb = new aws_elasticloadbalancingv2.ApplicationLoadBalancer(
        this,
        "AlbForEcs",
        {
          loadBalancerName: "AlbForEcsDemo",
          vpc: vpc,
          internetFacing: true,
        }
      );
  
      // add listener
      const listener = alb.addListener("Listener", {
        port: 80,
        open: true,
        protocol: aws_elasticloadbalancingv2.ApplicationProtocol.HTTP,
      });
  
      // add target
      listener.addTargets("EcsService", {
        port: 80,
        targets: [
          service.loadBalancerTarget({
            containerName: "aws-fcj-repo",
            containerPort: 3000,
            protocol: aws_ecs.Protocol.TCP,
          }),
        ],
        healthCheck: {
          timeout: Duration.seconds(10),
        },
      });
  
      // exported
      this.service = service;
    }
  }
  
  /**
   * Add a dependency from capacity provider association to the cluster
   * and from each service to the capacity provider association.
   */
  class CapacityProviderDependencyAspect implements IAspect {
    public visit(node: IConstruct): void {
      if (node instanceof aws_ecs.Ec2Service) {
        const children = node.cluster.node.findAll();
        for (const child of children) {
          if (child instanceof aws_ecs.CfnClusterCapacityProviderAssociations) {
            child.node.addDependency(node.cluster);
            node.node.addDependency(child);
          }
        }
      }
    }
  }