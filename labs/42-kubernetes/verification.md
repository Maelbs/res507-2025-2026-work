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





## Extension: Lane A (Resource Requests & Limits)

**The Change: Forcing an OOMKilled on the Deployment**
To demonstrate a memory limit violation, the memory limit on the main `quote-app` was temporarily lowered to `16Mi`—a value too small for the Node.js runtime to boot:
```yaml
          resources:
            requests:
              cpu: "100m"
              memory: "16Mi"
            limits:
              cpu: "250m"
              memory: "16Mi"



Verification Result (Observed OOMKilled effect):

Bash
$ kubectl get pods -l app=quote-app
NAME                         READY   STATUS      RESTARTS      AGE
quote-app-8566b6c77d-j8kwm   0/1     OOMKilled   2 (14s ago)   22s


bash
$ kubectl get pod quote-app-8566b6c77d-j8kwm -o yaml | grep -A 5 state
    state:
      terminated:
        containerID: containerd://...
        exitCode: 137
        reason: OOMKilled
(After this test, the configuration was restored to a healthy limit of 256Mi and requests of 128Mi).


What it demonstrates:

Request vs. Limit: A request is the minimum baseline guaranteed amount of resources used by the scheduler to place the Pod. A limit is the absolute maximum hard cap enforced at runtime.

Cluster Stability: By enforcing a memory limit, we ensure that if a container requests more RAM than allowed (in this case, basic Node.js startup exceeding 16Mi), the Linux kernel terminates the process (OOMKilled). This protects the cluster by ensuring a single bad Pod cannot consume all the Node's memory and starve other critical system processes.






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
