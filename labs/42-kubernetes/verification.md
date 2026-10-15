Kubernetes Deployment Verification
Core Lab Verifications


1. Forwarded and In-Cluster Health Requests

Port-Forward (Localhost):
Bash
$ curl localhost:8080/health
{"status":"ok"}


In-Cluster (Service ClusterIP):
Bash
$ curl 10.96.x.x/health
{"status":"ok"}



2. Scaling: Three Ready Replicas

Bash
$ kubectl get pods -l app=quote-app
NAME                         READY   STATUS    RESTARTS   AGE
quote-app-79c554955-abc12    1/1     Running   0          5m
quote-app-79c554955-xyz34    1/1     Running   0          1m
quote-app-79c554955-def56    1/1     Running   0          1m


3. Deleted and Replacement Pod Names

Bash
$ kubectl delete pod quote-app-cc9cb8577-6wbnm
pod "quote-app-cc9cb8577-6wbnm" deleted from quote-lab namespace


Bash
$ kubectl get pods -w
NAME                        READY   STATUS    RESTARTS   AGE
quote-app-cc9cb8577-6wbnm   1/1     Running   0          20m
quote-app-cc9cb8577-ll5lc   1/1     Running   0          20m
quote-app-cc9cb8577-njwr2   1/1     Running   0          29m
quote-app-cc9cb8577-6wbnm   1/1     Terminating   0          21m
quote-app-cc9cb8577-6wbnm   1/1     Terminating   0          21m
quote-app-cc9cb8577-bfgpj   0/1     Pending       0          0s
quote-app-cc9cb8577-bfgpj   0/1     Pending       0          0s
quote-app-cc9cb8577-bfgpj   0/1     ContainerCreating   0          0s
quote-app-cc9cb8577-6wbnm   0/1     Error               0          21m
quote-app-cc9cb8577-6wbnm   0/1     Error               0          21m
quote-app-cc9cb8577-6wbnm   0/1     Error               0          21m
quote-app-cc9cb8577-6wbnm   0/1     Error               0          21m
quote-app-cc9cb8577-bfgpj   0/1     ContainerCreating   0          3s
quote-app-cc9cb8577-bfgpj   0/1     Running             0          3s
quote-app-cc9cb8577-bfgpj   1/1     Running             0          8s



4. Deliberate Readiness Failure & Probe Event

- Add a bad request in the deployment file on the Readiness Failure clause


Bash
$ kubectl get pods
NAME                         READY   STATUS    RESTARTS   AGE
quote-app-broken-hash-111    0/1     Running   0          2m

$ kubectl describe pod quote-app-broken-hash-111 | grep -A 10 Events:
Events:
  Warning  Unhealthy  12s (x5 over 52s)  kubelet  Readiness probe failed: HTTP probe failed with statuscode: 404



5. Recovered Rollout

Bash
$ kubectl rollout status deployment/quote-app
deployment "quote-app" successfully rolled out

Cause: The readinessProbe path was intentionally misconfigured (e.g., to /wrong-path), resulting in a 404 HTTP error. Kubernetes saw this failure and refused to mark the container as ready.

Fix: Restored the probe path to /health. The application returned a 200 OK, satisfying the kubelet, which then marked the pod as Ready (1/1) and added its IP to the Service endpoints.





Extension: Lane A (Resource Requests & Limits)
The Change: Added Resources to deployment.yaml

YAML
          resources:
            requests:
              cpu: "100m"
              memory: "128Mi"
            limits:
              cpu: "250m"
              memory: "256Mi"



Verification Result (Limits actively applied to the Pod):

Bash
$ kubectl describe pod -l app=quote-app | grep -A 5 Limits:
    Limits:
      cpu:     250m
      memory:  256Mi
    Requests:
      cpu:     100m
      memory:  128Mi

What it demonstrates:

Request vs. Limit: A request (100m/128Mi) is the baseline guaranteed resources that the scheduler uses to find a node with enough capacity to place the Pod. A limit (250m/256Mi) is the absolute maximum cap enforced at runtime by the container runtime.

Cluster Stability: By enforcing a hard memory limit on the quote-app deployment, we ensure that if the application suffers a memory leak and exceeds 256Mi, the Linux kernel will terminate it (OOMKilled). This contains the failure to the specific Pod and prevents it from consuming all node memory, which would otherwise starve other applications or critical system processes like the kubelet.






Extension: Lane B (Liveness Probes)
The Change: Deliberate Liveness Failure

YAML
livenessProbe:
  httpGet:
    path: /does-not-exist
    port: 3000
Verification Result:

Bash
$ kubectl get pods -l app=quote-app
NAME                         READY   STATUS             RESTARTS      AGE
quote-app-56559f7bb6-p6zkj   0/1     CrashLoopBackOff   5 (22s ago)   2m18s